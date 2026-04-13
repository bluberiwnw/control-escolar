const pool = require('../database/connection');

const profesorController = {
    async getMaterias(req, res) {
        try {
            const result = await pool.query('SELECT * FROM materias WHERE profesor_id = $1 ORDER BY nombre', [req.usuario.id]);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

        async getEstadisticas(req, res) {
            try {
                const profesorId = req.usuario.id;
                // Materias del profesor
                const materias = await pool.query('SELECT id, estudiantes, promedio FROM materias WHERE profesor_id = $1', [profesorId]);
                const totalMaterias = materias.rows.length;
                const totalEstudiantes = materias.rows.reduce((sum, m) => sum + (m.estudiantes || 0), 0);
                const promedioGeneral = materias.rows.length
                    ? (materias.rows.reduce((sum, m) => sum + (m.promedio || 0), 0) / materias.rows.length).toFixed(1)
                    : 0;
                // Actividades activas (fecha_entrega >= hoy)
                const activas = await pool.query(`
                    SELECT COUNT(*) FROM actividades a
                    JOIN materias m ON a.materia_id = m.id
                    WHERE m.profesor_id = $1 AND a.fecha_entrega >= CURRENT_DATE
                `, [profesorId]);
                res.json({
                    totalMaterias,
                    totalEstudiantes,
                    promedioGeneral,
                    actividadesActivas: parseInt(activas.rows[0].count)
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },

    async getEvolucionCalificaciones(req, res) {
        try {
            const profesorId = req.usuario.id;
            const result = await pool.query(
                `SELECT 
                    to_char(date_trunc('month', c.created_at), 'YYYY-MM') AS mes,
                    AVG(c.calificacion)::numeric(10,2) AS promedio
                 FROM calificaciones c
                 JOIN materias m ON c.materia_id = m.id
                 WHERE m.profesor_id = $1
                 GROUP BY 1
                 ORDER BY 1`,
                [profesorId]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
};

module.exports = profesorController;