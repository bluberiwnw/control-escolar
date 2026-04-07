const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/connection');

const authController = {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos' });

      // Buscar en usuarios (profesores y admin)
      let result = await pool.query(
        'SELECT id, nombre, email, password, avatar, rol, activo, \'profesor\' as tipo FROM usuarios WHERE email = $1',
        [email]
      );
      let usuario = result.rows[0];

      if (!usuario) {
        // Buscar en estudiantes
        result = await pool.query(
          'SELECT id, nombre, email, password, NULL as avatar, \'alumno\' as rol, activo, \'alumno\' as tipo FROM estudiantes WHERE email = $1',
          [email]
        );
        usuario = result.rows[0];
      }

      if (!usuario) return res.status(401).json({ message: 'Credenciales incorrectas' });
      if (!usuario.activo) return res.status(401).json({ message: 'Cuenta desactivada' });

      const valid = await bcrypt.compare(password, usuario.password);
      if (!valid) return res.status(401).json({ message: 'Credenciales incorrectas' });

      const token = jwt.sign(
        { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, tipo: usuario.tipo },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.json({
        message: 'Login exitoso',
        token,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          avatar: usuario.avatar,
          rol: usuario.rol,
          tipo: usuario.tipo
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = authController;