const jwt = require('jsonwebtoken');
const pool = require('../database/connection');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Token no proporcionado' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id, email, rol, tipo } = decoded;

    let usuario = null;
    if (tipo === 'profesor') {
      const result = await pool.query(
        'SELECT id, nombre, email, avatar, rol, activo FROM usuarios WHERE id = $1 AND email = $2',
        [id, email]
      );
      if (result.rows.length) usuario = result.rows[0];
    } else if (tipo === 'alumno') {
      const result = await pool.query(
        'SELECT id, nombre, email, matricula, activo FROM estudiantes WHERE id = $1 AND email = $2',
        [id, email]
      );
      if (result.rows.length) {
        usuario = result.rows[0];
        usuario.rol = 'alumno';
      }
    }

    if (!usuario) return res.status(401).json({ message: 'Usuario no válido' });
    if (!usuario.activo) return res.status(401).json({ message: 'Cuenta desactivada' });

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      tipo,
      avatar: usuario.avatar || null
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Token inválido' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expirado' });
    res.status(500).json({ message: error.message });
  }
};