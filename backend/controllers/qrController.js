const pool = require('../database/connection');
const QRCode = require('qrcode');
const crypto = require('crypto');

function extractTokenFromPayload(body) {
  let raw = body.codigo;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw.token_unico) {
    return String(raw.token_unico);
  }
  const str = String(raw).trim();
  try {
    const parsed = JSON.parse(str);
    if (parsed && parsed.token_unico) {
      return String(parsed.token_unico);
    }
  } catch (_) {
    /* no es JSON */
  }
  try {
    const url = new URL(str);
    const c = url.searchParams.get('code');
    if (c) return c;
  } catch (_) {
    /* texto plano = token */
  }
  return str;
}

const generarQR = async (req, res) => {
  const { materia_id, fecha, hora_inicio, hora_fin } = req.body;
  const codigo = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO qr_asistencia (materia_id, codigo, fecha, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, $5)`,
    [materia_id, codigo, fecha, hora_inicio, hora_fin]
  );
  const payload = {
    materia_id: Number(materia_id),
    fecha,
    profesor_id: req.usuario.id,
    token_unico: codigo,
  };
  const qrPayload = JSON.stringify(payload);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 320, margin: 2 });
  const url = `${req.protocol}://${req.get('host')}/qr/validar?code=${codigo}`;
  res.json({ qrDataUrl, codigo, payload, url, download_url: qrDataUrl });
};

const registrarAsistenciaQR = async (req, res) => {
  const codigo = extractTokenFromPayload(req.body);
  if (!codigo) {
    return res.status(400).json({ error: 'QR inválido', message: '❌ No se pudo leer el código del QR.' });
  }
  const materiaEsperadaRaw = req.body?.materia_id;
  const materiaEsperada =
    materiaEsperadaRaw != null && materiaEsperadaRaw !== ''
      ? Number.parseInt(String(materiaEsperadaRaw), 10)
      : null;

  const alumnoId = req.usuario.id;

  const qrRes = await pool.query(
    `SELECT q.id, q.materia_id, q.fecha, q.hora_inicio, q.hora_fin, m.nombre AS materia_nombre
     FROM qr_asistencia q
     JOIN materias m ON m.id = q.materia_id
     WHERE q.codigo = $1 AND q.activo = true`,
    [codigo]
  );
  if (qrRes.rows.length === 0) {
    return res.status(400).json({
      error: 'QR inválido',
      message: '❌ Código QR no reconocido o ya no está activo. Pide un código nuevo al docente.',
    });
  }
  const qr = qrRes.rows[0];

  if (Number.isInteger(materiaEsperada) && materiaEsperada > 0 && qr.materia_id !== materiaEsperada) {
    return res.status(400).json({
      error: 'Materia no coincide',
      message: `❌ Este QR es de otra materia (${qr.materia_nombre}). Elige la materia correcta antes de escanear.`,
    });
  }

  // Validación de fecha con zona horaria local
  const ahora = new Date();
  const fechaLocal = ahora.toISOString().split('T')[0]; // YYYY-MM-DD en zona local
  
  if (qr.fecha !== fechaLocal) {
    return res.status(400).json({
      error: 'Fecha incorrecta',
      message: `La fecha de este código (${qr.fecha}) no coincide con el día de hoy (${fechaLocal}). El docente debe generar el QR con la fecha de hoy.`,
    });
  }

  // Validación de hora con tolerancia de 5 minutos antes y después
  const horaActual = ahora.toTimeString().slice(0, 5); // HH:MM
  const [horaInicio, horaFin] = [qr.hora_inicio, qr.hora_fin];
  
  // Convertir a minutos para comparación
  const minutosActuales = parseInt(horaActual.split(':')[0]) * 60 + parseInt(horaActual.split(':')[1]);
  const minutosInicio = parseInt(horaInicio.split(':')[0]) * 60 + parseInt(horaInicio.split(':')[1]) - 5; // 5 min antes
  const minutosFin = parseInt(horaFin.split(':')[0]) * 60 + parseInt(horaFin.split(':')[1]) + 5; // 5 min después
  
  if (minutosActuales < minutosInicio || minutosActuales > minutosFin) {
    const hi = String(qr.hora_inicio).slice(0, 5);
    const hf = String(qr.hora_fin).slice(0, 5);
    return res.status(400).json({
      error: 'Horario incorrecto',
      message: `Fuera del horario permitido para este código (válido entre ${hi} y ${hf}, con 5 min de tolerancia). Hora actual: ${horaActual}`,
    });
  }

  const fechaClase = qr.fecha;
  await pool.query(
    `INSERT INTO asistencias_qr (estudiante_id, qr_id) VALUES ($1, $2)
     ON CONFLICT (estudiante_id, qr_id) DO NOTHING`,
    [alumnoId, qr.id]
  );
  const ins = await pool.query(
    `INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado)
     VALUES ($1, $2, $3, 'presente')
     ON CONFLICT (materia_id, estudiante_id, fecha) DO NOTHING
     RETURNING id`,
    [qr.materia_id, alumnoId, fechaClase]
  );
  if (ins.rowCount === 0) {
    return res.json({ message: '✅ Tu asistencia ya estaba registrada para esta clase' });
  }
  res.json({ message: '✅ Asistencia registrada' });
};

module.exports = { generarQR, registrarAsistenciaQR, extractTokenFromPayload };
