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
    return res.status(400).json({ error: 'QR inválido', message: '❌ QR inválido' });
  }
  const alumnoId = req.usuario.id;
  const qrRes = await pool.query(
    `SELECT id, materia_id FROM qr_asistencia 
     WHERE codigo = $1 AND activo = true AND fecha = CURRENT_DATE 
     AND CURRENT_TIME BETWEEN hora_inicio AND hora_fin`,
    [codigo]
  );
  if (qrRes.rows.length === 0) {
    return res.status(400).json({ error: 'QR inválido o expirado', message: '❌ QR inválido' });
  }
  const qr = qrRes.rows[0];
  await pool.query(`INSERT INTO asistencias_qr (estudiante_id, qr_id) VALUES ($1, $2)`, [alumnoId, qr.id]);
  await pool.query(
    `INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado)
     VALUES ($1, $2, CURRENT_DATE, 'presente')
     ON CONFLICT (materia_id, estudiante_id, fecha) DO NOTHING`,
    [qr.materia_id, alumnoId]
  );
  res.json({ message: '✅ Asistencia registrada' });
};

module.exports = { generarQR, registrarAsistenciaQR, extractTokenFromPayload };
