const pool = require('../database/connection');

const materiaController = {
  async getAll(req, res) {
    try {
      let query = 'SELECT * FROM materias';
      let params = [];
      if (req.usuario.rol === 'profesor') {
        query += ' WHERE profesor_id = $1';
        params = [req.usuario.id];
      } else if (req.usuario.rol === 'alumno') {
        // Los alumnos ven materias a través de sus calificaciones o inscripciones; simplificado: todas las materias
        // Para no complicar, devolvemos todas (en alumno se filtrará luego)
        query = 'SELECT * FROM materias';
      }
      query += ' ORDER BY nombre';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req, res) {
    if (req.usuario.rol !== 'administrador') return res.status(403).json({ message: 'No autorizado' });
    const { nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id } = req.body;
    const result = await pool.query(
      `INSERT INTO materias (nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [nombre, clave, horario, estudiantes || 0, bajas || 0, promedio || 0, semestre, color, profesor_id]
    );
    res.status(201).json(result.rows[0]);
  },

  async update(req, res) {
    if (req.usuario.rol !== 'administrador') return res.status(403).json({ message: 'No autorizado' });
    const { id } = req.params;
    const { nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id } = req.body;
    await pool.query(
      `UPDATE materias SET nombre=$1, clave=$2, horario=$3, estudiantes=$4, bajas=$5, promedio=$6, semestre=$7, color=$8, profesor_id=$9 WHERE id=$10`,
      [nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id, id]
    );
    res.json({ message: 'Materia actualizada' });
  },

  async delete(req, res) {
    if (req.usuario.rol !== 'administrador') return res.status(403).json({ message: 'No autorizado' });
    const { id } = req.params;
    await pool.query('DELETE FROM materias WHERE id = $1', [id]);
    res.json({ message: 'Materia eliminada' });
  }
};

module.exports = materiaController;