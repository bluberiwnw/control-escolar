const pool = require('../database/connection');

const asistenciaController = {
    async getByMateriaYFecha(req, res) {
        try {
            const { materia_id, fecha } = req.params;
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            const result = await pool.query(
                `SELECT a.*, e.nombre, e.matricula 
                 FROM asistencias a
                 JOIN estudiantes e ON a.estudiante_id = e.id
                 WHERE a.materia_id = $1 AND a.fecha = $2
                 ORDER BY e.nombre`,
                [materia_id, fecha]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async save(req, res) {
        try {
            const { materia_id, estudiante_id, fecha, estado } = req.body;
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            const existente = await pool.query(
                'SELECT id FROM asistencias WHERE materia_id = $1 AND estudiante_id = $2 AND fecha = $3',
                [materia_id, estudiante_id, fecha]
            );
            if (existente.rows.length > 0) {
                await pool.query('UPDATE asistencias SET estado = $1 WHERE id = $2', [estado, existente.rows[0].id]);
                const actualizada = await pool.query(
                    `SELECT a.*, e.nombre, e.matricula 
                     FROM asistencias a
                     JOIN estudiantes e ON a.estudiante_id = e.id
                     WHERE a.id = $1`,
                    [existente.rows[0].id]
                );
                res.json(actualizada.rows[0]);
            } else {
                const insertResult = await pool.query(
                    'INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado) VALUES ($1, $2, $3, $4) RETURNING id',
                    [materia_id, estudiante_id, fecha, estado]
                );
                const nueva = await pool.query(
                    `SELECT a.*, e.nombre, e.matricula 
                     FROM asistencias a
                     JOIN estudiantes e ON a.estudiante_id = e.id
                     WHERE a.id = $1`,
                    [insertResult.rows[0].id]
                );
                res.status(201).json(nueva.rows[0]);
            }
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async saveBatch(req, res) {
        try {
            const asistencias = req.body;
            if (!Array.isArray(asistencias) || asistencias.length === 0) {
                return res.status(400).json({ message: 'Se requiere un array de asistencias' });
            }
            const materiaIds = [...new Set(asistencias.map(a => a.materia_id))];
            for (const materia_id of materiaIds) {
                const check = await pool.query(
                    'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                    [materia_id, req.usuario.id]
                );
                if (check.rows.length === 0) {
                    return res.status(404).json({ message: `Materia ${materia_id} no encontrada` });
                }
            }
            for (const a of asistencias) {
                const { materia_id, estudiante_id, fecha, estado } = a;
                const existente = await pool.query(
                    'SELECT id FROM asistencias WHERE materia_id = $1 AND estudiante_id = $2 AND fecha = $3',
                    [materia_id, estudiante_id, fecha]
                );
                if (existente.rows.length > 0) {
                    await pool.query('UPDATE asistencias SET estado = $1 WHERE id = $2', [estado, existente.rows[0].id]);
                } else {
                    await pool.query(
                        'INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado) VALUES ($1, $2, $3, $4)',
                        [materia_id, estudiante_id, fecha, estado]
                    );
                }
            }
            res.json({ message: 'Asistencias guardadas correctamente', count: asistencias.length });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getEstadisticas(req, res) {
        try {
            const { materia_id } = req.params;
            const materiaCheck = await pool.query(
                'SELECT id, estudiantes FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            const estadisticas = await pool.query(
                `SELECT fecha,
                    SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as presentes,
                    SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as ausentes,
                    SUM(CASE WHEN estado = 'retardo' THEN 1 ELSE 0 END) as retardos,
                    COUNT(*) as total
                 FROM asistencias
                 WHERE materia_id = $1
                 GROUP BY fecha
                 ORDER BY fecha DESC`,
                [materia_id]
            );
            const totales = await pool.query(
                `SELECT 
                    SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as total_presentes,
                    SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as total_ausentes,
                    SUM(CASE WHEN estado = 'retardo' THEN 1 ELSE 0 END) as total_retardos,
                    COUNT(DISTINCT fecha) as total_clases
                 FROM asistencias
                 WHERE materia_id = $1`,
                [materia_id]
            );
            res.json({ totales: totales.rows[0], por_fecha: estadisticas.rows });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = asistenciaController;