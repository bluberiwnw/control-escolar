const pool = require('../database/connection');

const asistenciaController = {
  async getByMateriaYFecha(req, res) {
    const { materia_id, fecha } = req.params;
    const result = await pool.query(
      `SELECT a.*, e.nombre, e.matricula 
       FROM asistencias a JOIN estudiantes e ON a.estudiante_id = e.id
       WHERE a.materia_id = $1 AND a.fecha = $2`,
      [materia_id, fecha]
    );
    res.json(result.rows);
  },

  async saveBatch(req, res) {
    const asistencias = req.body;
    for (const a of asistencias) {
      await pool.query(
        `INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (materia_id, estudiante_id, fecha) DO UPDATE SET estado = EXCLUDED.estado`,
        [a.materia_id, a.estudiante_id, a.fecha, a.estado]
      );
    }
    res.json({ message: 'Asistencias guardadas' });
  }
};

module.exports = asistenciaController;