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
  
  // Convertir fecha a UTC para consistencia
  const fechaUTC = new Date(fecha).toISOString().split('T')[0];
  
  console.log('🔍 DEBUG - Generación QR:');
  console.log('🔍 fecha original:', fecha);
  console.log('🔍 fechaUTC:', fechaUTC);
  console.log('🔍 fechaUTC tipo:', typeof fechaUTC);
  
  // Validar datos básicos
  if (!materia_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({
      error: 'Datos incompletos',
      message: 'Se requieren materia, fecha, hora de inicio y hora de fin',
    });
  }
  
  // Validar que la materia exista y pertenezca al profesor
  try {
    const materiaCheck = await pool.query(
      'SELECT id, nombre FROM materias WHERE id = $1 AND profesor_id = $2',
      [materia_id, req.usuario.id]
    );
    if (materiaCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Materia no encontrada',
        message: 'La materia no existe o no tienes permisos para acceder a ella',
      });
    }
  } catch (error) {
    console.error('Error verificando materia:', error);
    return res.status(500).json({
      error: 'Error del servidor',
      message: 'Error al verificar la materia',
    });
  }
  
  // Validar horario 7am-9pm
  const [hi, mi] = hora_inicio.split(':').map(Number);
  const [hf, mf] = hora_fin.split(':').map(Number);
  const minutosInicio = hi * 60 + mi;
  const minutosFin = hf * 60 + mf;
  const minutosMinimoDia = 7 * 60; // 7:00 AM
  const minutosMaximoDia = 21 * 60; // 9:00 PM
  
  if (minutosInicio < minutosMinimoDia || minutosFin > minutosMaximoDia) {
    return res.status(400).json({
      error: 'Horario fuera de rango',
      message: 'El horario de asistencia debe estar entre 7:00 AM y 9:00 PM',
    });
  }
  
  // Generar código único con más entropía
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(32);
  const codigo = crypto.createHash('sha256')
    .update(`${materia_id}-${fecha}-${req.usuario.id}-${timestamp}-${randomBytes.toString('hex')}`)
    .digest('hex')
    .substring(0, 32);
  
  // Verificar que el código no exista
  const existente = await pool.query('SELECT id FROM qr_asistencia WHERE codigo = $1', [codigo]);
  if (existente.rows.length > 0) {
    return res.status(500).json({
      error: 'Error de generación',
      message: 'No se pudo generar un código único. Intenta de nuevo.',
    });
  }
  
  await pool.query(
    `INSERT INTO qr_asistencia (materia_id, codigo, fecha, hora_inicio, hora_fin, activo)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [materia_id, codigo, fechaUTC, hora_inicio, hora_fin]
  );
  
  const payload = {
    materia_id: Number(materia_id),
    fecha: fechaUTC,
    profesor_id: req.usuario.id,
    token_unico: codigo,
    timestamp,
    version: '2.0',
  };
  
  const qrPayload = JSON.stringify(payload);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { 
    width: 320, 
    margin: 2,
    errorCorrectionLevel: 'H' // Mayor nivel de corrección de errores
  });
  
  const url = `${req.protocol}://${req.get('host')}/qr/validar?code=${codigo}`;
  
  // Registrar log de generación para auditoría (si la tabla existe)
  try {
    await pool.query(
      `INSERT INTO qr_logs (qr_id, materia_id, accion, timestamp)
       VALUES ($1, $2, 'generar', CURRENT_TIMESTAMP)`,
      [codigo, materia_id]
    );
  } catch (logError) {
    // Ignorar error si la tabla qr_logs no existe
    console.warn('No se pudo registrar log de QR:', logError.message);
  }
  
  res.json({ 
    qrDataUrl, 
    codigo, 
    payload, 
    url, 
    download_url: qrDataUrl,
    mensaje: 'QR generado exitosamente. Válido solo para el día y horario especificados.',
    horario_permitido: `${hora_inicio} - ${hora_fin}`,
    tolerancia: '5 minutos antes y después'
  });
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
    `SELECT q.id, q.materia_id, TO_CHAR(q.fecha, 'YYYY-MM-DD') as fecha, q.hora_inicio, q.hora_fin, m.nombre AS materia_nombre
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

  // Validación de fecha usando UTC para consistencia
  const ahora = new Date();
  const fechaUTC = ahora.toISOString().split('T')[0]; // YYYY-MM-DD en UTC
  
  console.log('🔍 DEBUG - Validación de fecha:');
  console.log('🔍 QR.fecha:', qr.fecha);
  console.log('🔍 QR.fecha tipo:', typeof qr.fecha);
  console.log('🔍 fechaUTC:', fechaUTC);
  console.log('🔍 fechaUTC tipo:', typeof fechaUTC);
  console.log('🔍 Son iguales?:', qr.fecha === fechaUTC);
  
  if (qr.fecha !== fechaUTC) {
    return res.status(400).json({
      error: 'Fecha incorrecta',
      message: `La fecha de este código (${qr.fecha}) no coincide con el día de hoy (${fechaUTC}). El docente debe generar el QR con la fecha de hoy.`,
    });
  }

  // Validación de hora con tolerancia de 5 minutos antes y después
  const horaActual = ahora.toTimeString().slice(0, 5); // HH:MM
  const [horaInicio, horaFin] = [qr.hora_inicio, qr.hora_fin];
  
  // Validar que la hora actual esté entre 7am y 9pm
  const minutosActuales = parseInt(horaActual.split(':')[0]) * 60 + parseInt(horaActual.split(':')[1]);
  const minutosMinimoDia = 7 * 60; // 7:00 AM = 420 minutos
  const minutosMaximoDia = 21 * 60; // 9:00 PM = 1260 minutos
  
  if (minutosActuales < minutosMinimoDia || minutosActuales > minutosMaximoDia) {
    return res.status(400).json({
      error: 'Fuera de horario escolar',
      message: `El sistema de asistencia funciona solo de 7:00 AM a 9:00 PM. Hora actual: ${horaActual}`,
    });
  }
  
  // Convertir a minutos para comparación
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
  
  // Registrar log de escaneo para auditoría (si la tabla existe)
  try {
    await pool.query(
      `INSERT INTO qr_logs (qr_id, estudiante_id, materia_id, accion, timestamp)
       VALUES ($1, $2, $3, 'escaneado', CURRENT_TIMESTAMP)`,
      [qr.id, alumnoId, qr.materia_id]
    );
  } catch (logError) {
    // Ignorar error si la tabla qr_logs no existe
    console.warn('No se pudo registrar log de escaneo QR:', logError.message);
  }
  
  // Verificar si ya existe asistencia para este QR
  const asistenciaExistente = await pool.query(
    `SELECT id FROM asistencias_qr 
     WHERE estudiante_id = $1 AND qr_id = $2`,
    [alumnoId, qr.id]
  );
  
  if (asistenciaExistente.rows.length > 0) {
    return res.json({ 
      message: '✅ Tu asistencia ya estaba registrada para esta clase',
      estado: 'presente',
      materia: qr.materia_nombre,
      timestamp: new Date().toISOString()
    });
  }
  
  // Registrar asistencia QR
  await pool.query(
    `INSERT INTO asistencias_qr (estudiante_id, qr_id) VALUES ($1, $2)`,
    [alumnoId, qr.id]
  );
  
  // Registrar asistencia en tabla principal
  const ins = await pool.query(
    `INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado, hora_registro)
     VALUES ($1, $2, $3, 'presente', CURRENT_TIME)
     ON CONFLICT (materia_id, estudiante_id, fecha) DO UPDATE
     SET estado = 'presente', hora_registro = CURRENT_TIME
     RETURNING id`,
    [qr.materia_id, alumnoId, fechaClase]
  );
  
  if (ins.rowCount === 0) {
    return res.json({ 
      message: '✅ Tu asistencia ya estaba registrada para esta clase',
      estado: 'presente',
      materia: qr.materia_nombre,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({ 
    message: '✅ Asistencia registrada exitosamente',
    estado: 'presente',
    materia: qr.materia_nombre,
    timestamp: new Date().toISOString()
  });
};

module.exports = { generarQR, registrarAsistenciaQR, extractTokenFromPayload };
