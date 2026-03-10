const pool = require('../database/connection');

const profesorController = {
    // Obtener todas las materias del profesor
    async getMaterias(req, res) {
        try {
            const [materias] = await pool.query(
                `SELECT * FROM materias 
                 WHERE profesor_id = ? 
                 ORDER BY nombre`,
                [req.profesor.id]
            );
            
            res.json(materias);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Obtener estadísticas generales del profesor
    async getEstadisticas(req, res) {
        try {
            // Total de materias
            const [materias] = await pool.query(
                'SELECT COUNT(*) as total FROM materias WHERE profesor_id = ?',
                [req.profesor.id]
            );
            
            // Total de estudiantes (suma de todas las materias)
            const [estudiantes] = await pool.query(
                'SELECT SUM(estudiantes) as total FROM materias WHERE profesor_id = ?',
                [req.profesor.id]
            );
            
            // Promedio general
            const [promedios] = await pool.query(
                'SELECT AVG(promedio) as promedio FROM materias WHERE profesor_id = ?',
                [req.profesor.id]
            );
            
            // Actividades activas
            const [actividades] = await pool.query(
                `SELECT COUNT(*) as total 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE m.profesor_id = ? AND a.fecha_entrega >= CURDATE()`,
                [req.profesor.id]
            );
            
            res.json({
                totalMaterias: materias[0].total,
                totalEstudiantes: estudiantes[0].total || 0,
                promedioGeneral: promedios[0].promedio || 0,
                actividadesActivas: actividades[0].total || 0
            });
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = profesorController;