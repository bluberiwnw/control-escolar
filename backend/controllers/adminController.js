const pool = require('../database/connection');
const bcrypt = require('bcryptjs');

const adminController = {
  async listarUsuarios(req, res) {
    const usuarios = await pool.query('SELECT id, nombre, email, rol, activo, created_at FROM usuarios');
    const estudiantes = await pool.query('SELECT id, nombre, email, matricula, activo, created_at FROM estudiantes');
    res.json({ profesores: usuarios.rows, estudiantes: estudiantes.rows });
  },

  async crearUsuario(req, res) {
    const { nombre, email, password, rol, tipo } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    if (tipo === 'profesor') {
      await pool.query('INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)', [nombre, email, hashed, rol]);
    } else {
      const { matricula } = req.body;
      await pool.query('INSERT INTO estudiantes (nombre, email, password, matricula, rol) VALUES ($1, $2, $3, $4, $5)', [nombre, email, hashed, matricula, 'alumno']);
    }
    res.json({ message: 'Usuario creado' });
  },

  async toggleActivo(req, res) {
    const { tipo, id } = req.params;
    const table = tipo === 'profesor' ? 'usuarios' : 'estudiantes';
    await pool.query(`UPDATE ${table} SET activo = NOT activo WHERE id = $1`, [id]);
    res.json({ message: 'Estado actualizado' });
  }
};

module.exports = adminController;