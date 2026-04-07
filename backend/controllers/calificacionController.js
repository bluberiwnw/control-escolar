const pool = require('../database/connection');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { procesarExcelCalificaciones } = require('../services/excelService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 } }).single('archivo');

const calificacionController = {
  async uploadFile(req, res) {
    upload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: 'No se seleccionó archivo' });
      try {
        const { materia_id, tipo } = req.body;
        // Guardar registro del archivo
        const insert = await pool.query(
          `INSERT INTO archivos_calificaciones (profesor_id, materia_id, nombre_archivo, tipo)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [req.usuario.id, materia_id, req.file.originalname, tipo]
        );
        let detalles = '';
        if (req.file.mimetype.includes('spreadsheet')) {
          const resultado = await procesarExcelCalificaciones(req.file.path, materia_id);
          detalles = `Insertados: ${resultado.exitosos}, Errores: ${resultado.errores.length} - ${resultado.errores.join('; ')}`;
          await pool.query(`UPDATE archivos_calificaciones SET estado='Procesado', detalles=$1 WHERE id=$2`, [detalles, insert.rows[0].id]);
        }
        res.json({ message: 'Archivo procesado', archivo: { nombre: req.file.originalname, detalles } });
      } catch (error) {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ message: error.message });
      }
    });
  },

  async getArchivos(req, res) {
    const result = await pool.query(
      `SELECT a.*, m.nombre as materia_nombre 
       FROM archivos_calificaciones a JOIN materias m ON a.materia_id = m.id
       WHERE a.profesor_id = $1 ORDER BY a.fecha_subida DESC`,
      [req.usuario.id]
    );
    res.json(result.rows);
  },

  async getCalificacionesFinales(req, res) {
    const { materia_id } = req.params;
    const result = await pool.query(
      `SELECT e.nombre, e.matricula, cf.calificacion
       FROM calificaciones_finales cf
       JOIN estudiantes e ON cf.estudiante_id = e.id
       WHERE cf.materia_id = $1`,
      [materia_id]
    );
    res.json(result.rows);
  }
};

module.exports = calificacionController;