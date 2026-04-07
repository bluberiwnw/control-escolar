const pool = require('../database/connection');

const actividadController = {
  async getAll(req, res) {
    try {
      const { materia_id } = req.query;
      let query = `
        SELECT a.*, m.nombre as materia_nombre, m.color 
        FROM actividades a JOIN materias m ON a.materia_id = m.id
      `;
      let params = [];
      if (req.usuario.rol === 'profesor') {
        query += ' WHERE m.profesor_id = $1';
        params.push(req.usuario.id);
        if (materia_id) {
          query += ' AND a.materia_id = $2';
          params.push(materia_id);
        }
      } else if (req.usuario.rol === 'administrador') {
        if (materia_id) {
          query += ' WHERE a.materia_id = $1';
          params.push(materia_id);
        }
      } else {
        // alumno: ver actividades de sus materias (simplificado: todas)
        if (materia_id) {
          query += ' WHERE a.materia_id = $1';
          params.push(materia_id);
        }
      }
      query += ' ORDER BY a.fecha_entrega';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req, res) {
    if (!['profesor', 'administrador'].includes(req.usuario.rol)) return res.status(403).json({ message: 'No autorizado' });
    const { materia_id, tipo, titulo, descripcion, fecha_entrega, valor } = req.body;
    // Verificar que la materia pertenece al profesor (si es profesor)
    if (req.usuario.rol === 'profesor') {
      const check = await pool.query('SELECT id FROM materias WHERE id = $1 AND profesor_id = $2', [materia_id, req.usuario.id]);
      if (check.rows.length === 0) return res.status(404).json({ message: 'Materia no pertenece al profesor' });
    }
    const result = await pool.query(
      `INSERT INTO actividades (materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [materia_id, tipo, titulo, descripcion, fecha_entrega, valor || 100]
    );
    res.status(201).json(result.rows[0]);
  },

  async update(req, res) {
    if (!['profesor', 'administrador'].includes(req.usuario.rol)) return res.status(403).json({ message: 'No autorizado' });
    const { id } = req.params;
    const { tipo, titulo, descripcion, fecha_entrega, valor } = req.body;
    await pool.query(
      `UPDATE actividades SET tipo=$1, titulo=$2, descripcion=$3, fecha_entrega=$4, valor=$5 WHERE id=$6`,
      [tipo, titulo, descripcion, fecha_entrega, valor, id]
    );
    res.json({ message: 'Actividad actualizada' });
  },

  async delete(req, res) {
    if (!['profesor', 'administrador'].includes(req.usuario.rol)) return res.status(403).json({ message: 'No autorizado' });
    const { id } = req.params;
    await pool.query('DELETE FROM actividades WHERE id = $1', [id]);
    res.json({ message: 'Actividad eliminada' });
  }
};

module.exports = actividadController;