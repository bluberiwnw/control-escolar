const pool = require('../database/connection');
const QRCode = require('qrcode');
const crypto = require('crypto');

const generarQR = async (req, res) => {
  const { materia_id, fecha, hora_inicio, hora_fin } = req.body;
  const codigo = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO qr_asistencia (materia_id, codigo, fecha, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, $5)`,
    [materia_id, codigo, fecha, hora_inicio, hora_fin]
  );
  const url = `${req.protocol}://${req.get('host')}/api/qr/validar?code=${codigo}`;
  const qrDataUrl = await QRCode.toDataURL(url);
  res.json({ qrDataUrl, codigo });
};

const registrarAsistenciaQR = async (req, res) => {
  const { codigo } = req.body;
  const alumnoId = req.usuario.id;
  const qrRes = await pool.query(
    `SELECT id, materia_id FROM qr_asistencia 
     WHERE codigo = $1 AND activo = true AND fecha = CURRENT_DATE 
     AND CURRENT_TIME BETWEEN hora_inicio AND hora_fin`,
    [codigo]
  );
  if (qrRes.rows.length === 0) return res.status(400).json({ error: 'QR inválido o expirado' });
  const qr = qrRes.rows[0];
  await pool.query(`INSERT INTO asistencias_qr (estudiante_id, qr_id) VALUES ($1, $2)`, [alumnoId, qr.id]);
  await pool.query(
    `INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado)
     VALUES ($1, $2, CURRENT_DATE, 'presente')
     ON CONFLICT (materia_id, estudiante_id, fecha) DO NOTHING`,
    [qr.materia_id, alumnoId]
  );
  res.json({ message: 'Asistencia registrada' });
};

module.exports = { generarQR, registrarAsistenciaQR };