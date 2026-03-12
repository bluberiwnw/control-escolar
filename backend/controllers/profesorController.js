const pool = require('../database/connection');

const profesorController = {
    async getMaterias(req, res) {
        try {
            const result = await pool.query(
                'SELECT * FROM materias WHERE profesor_id = $1 ORDER BY nombre',
                [req.profesor.id]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getEstadisticas(req, res) {
        try {
            const materias = await pool.query(
                'SELECT COUNT(*) as total FROM materias WHERE profesor_id = $1',
                [req.profesor.id]
            );

            const estudiantes = await pool.query(
                'SELECT SUM(estudiantes) as total FROM materias WHERE profesor_id = $1',
                [req.profesor.id]
            );

            const promedios = await pool.query(
                'SELECT AVG(promedio) as promedio FROM materias WHERE profesor_id = $1',
                [req.profesor.id]
            );

            const actividades = await pool.query(
                `SELECT COUNT(*) as total 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE m.profesor_id = $1 AND a.fecha_entrega >= CURRENT_DATE`,
                [req.profesor.id]
            );

            res.json({
                totalMaterias: parseInt(materias.rows[0].total),
                totalEstudiantes: parseInt(estudiantes.rows[0].total) || 0,
                promedioGeneral: parseFloat(promedios.rows[0].promedio) || 0,
                actividadesActivas: parseInt(actividades.rows[0].total) || 0
            });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = profesorController;