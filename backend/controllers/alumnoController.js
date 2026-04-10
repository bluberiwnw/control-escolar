const pool = require('../database/connection');

const alumnoController = {
    // Obtener materias en las que está inscrito el alumno
    async getMaterias(req, res) {
        try {
            const alumnoId = req.usuario.id;
            const result = await pool.query(`
                SELECT m.*, u.nombre as profesor_nombre
                FROM inscripciones i
                JOIN materias m ON i.materia_id = m.id
                LEFT JOIN usuarios u ON m.profesor_id = u.id
                WHERE i.estudiante_id = $1
                ORDER BY m.nombre
            `, [alumnoId]);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Obtener actividades de las materias del alumno (con estado de entrega)
    async getActividades(req, res) {
        try {
            const alumnoId = req.usuario.id;
            const result = await pool.query(`
                SELECT a.*, m.nombre as materia_nombre,
                    CASE WHEN e.id IS NOT NULL THEN true ELSE false END as entregado,
                    e.archivo as archivo_entrega, e.calificacion as calificacion_entrega
                FROM actividades a
                JOIN materias m ON a.materia_id = m.id
                LEFT JOIN entregas e ON e.actividad_id = a.id AND e.estudiante_id = $1
                ORDER BY a.fecha_entrega ASC
            `, [alumnoId]);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Subir entrega de actividad
    async subirEntrega(req, res) {
        try {
            const { actividad_id, comentario } = req.body;
            const alumnoId = req.usuario.id;
            const archivo = req.file ? req.file.filename : null;
            if (!archivo) return res.status(400).json({ error: 'Archivo requerido' });
            await pool.query(
                `INSERT INTO entregas (actividad_id, estudiante_id, archivo, comentario)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (actividad_id, estudiante_id) 
                 DO UPDATE SET archivo = EXCLUDED.archivo, comentario = EXCLUDED.comentario, fecha_entrega = CURRENT_TIMESTAMP`,
                [actividad_id, alumnoId, archivo, comentario]
            );
            res.json({ message: 'Entrega subida correctamente' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Obtener calificaciones finales del alumno
    async getCalificaciones(req, res) {
        try {
            const alumnoId = req.usuario.id;
            const result = await pool.query(`
                SELECT cf.calificacion, m.nombre as materia_nombre
                FROM calificaciones_finales cf
                JOIN materias m ON cf.materia_id = m.id
                WHERE cf.estudiante_id = $1
                ORDER BY m.nombre
            `, [alumnoId]);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Obtener historial de asistencias del alumno
    async getAsistencias(req, res) {
        try {
            const alumnoId = req.usuario.id;
            const result = await pool.query(`
                SELECT a.fecha, a.estado, m.nombre as materia_nombre
                FROM asistencias a
                JOIN materias m ON a.materia_id = m.id
                WHERE a.estudiante_id = $1
                ORDER BY a.fecha DESC
            `, [alumnoId]);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Reportes personales (promedio, asistencias)
    async getReportes(req, res) {
        try {
            const alumnoId = req.usuario.id;
            const promedio = await pool.query(`
                SELECT AVG(calificacion) as promedio FROM calificaciones_finales WHERE estudiante_id = $1
            `, [alumnoId]);
            const asistencias = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as presentes
                FROM asistencias
                WHERE estudiante_id = $1
            `, [alumnoId]);
            const asisPercent = asistencias.rows[0].total > 0 
                ? (asistencias.rows[0].presentes * 100 / asistencias.rows[0].total).toFixed(1)
                : 0;
            res.json({
                promedio_general: parseFloat(promedio.rows[0].promedio) || 0,
                asistencia_global: asisPercent
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
};

module.exports = alumnoController;