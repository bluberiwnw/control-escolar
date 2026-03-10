const pool = require('../database/connection');

const asistenciaController = {
    // Obtener asistencias por materia y fecha
    async getByMateriaYFecha(req, res) {
        try {
            const { materia_id, fecha } = req.params;
            
            // Verificar que la materia pertenece al profesor
            const [materias] = await pool.query(
                'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                [materia_id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            const [asistencias] = await pool.query(
                `SELECT a.*, e.nombre, e.matricula 
                 FROM asistencias a
                 JOIN estudiantes e ON a.estudiante_id = e.id
                 WHERE a.materia_id = ? AND a.fecha = ?
                 ORDER BY e.nombre`,
                [materia_id, fecha]
            );
            
            res.json(asistencias);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Guardar o actualizar una asistencia
    async save(req, res) {
        try {
            const { materia_id, estudiante_id, fecha, estado } = req.body;
            
            // Verificar que la materia pertenece al profesor
            const [materias] = await pool.query(
                'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                [materia_id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Verificar si ya existe
            const [existentes] = await pool.query(
                'SELECT id FROM asistencias WHERE materia_id = ? AND estudiante_id = ? AND fecha = ?',
                [materia_id, estudiante_id, fecha]
            );
            
            if (existentes.length > 0) {
                // Actualizar
                await pool.query(
                    'UPDATE asistencias SET estado = ? WHERE id = ?',
                    [estado, existentes[0].id]
                );
                
                const [actualizada] = await pool.query(
                    `SELECT a.*, e.nombre, e.matricula 
                     FROM asistencias a
                     JOIN estudiantes e ON a.estudiante_id = e.id
                     WHERE a.id = ?`,
                    [existentes[0].id]
                );
                
                res.json(actualizada[0]);
            } else {
                // Insertar nueva
                const [result] = await pool.query(
                    'INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado) VALUES (?, ?, ?, ?)',
                    [materia_id, estudiante_id, fecha, estado]
                );
                
                const [nueva] = await pool.query(
                    `SELECT a.*, e.nombre, e.matricula 
                     FROM asistencias a
                     JOIN estudiantes e ON a.estudiante_id = e.id
                     WHERE a.id = ?`,
                    [result.insertId]
                );
                
                res.status(201).json(nueva[0]);
            }
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Guardar lote de asistencias
    async saveBatch(req, res) {
        try {
            const asistencias = req.body;
            
            if (!Array.isArray(asistencias) || asistencias.length === 0) {
                return res.status(400).json({ message: 'Se requiere un array de asistencias' });
            }
            
            // Verificar que todas las materias pertenecen al profesor
            const materiaIds = [...new Set(asistencias.map(a => a.materia_id))];
            
            for (const materia_id of materiaIds) {
                const [materias] = await pool.query(
                    'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                    [materia_id, req.profesor.id]
                );
                
                if (materias.length === 0) {
                    return res.status(404).json({ 
                        message: `Materia ${materia_id} no encontrada o no pertenece al profesor` 
                    });
                }
            }
            
            // Procesar cada asistencia
            for (const asistencia of asistencias) {
                const { materia_id, estudiante_id, fecha, estado } = asistencia;
                
                // Verificar si existe
                const [existentes] = await pool.query(
                    'SELECT id FROM asistencias WHERE materia_id = ? AND estudiante_id = ? AND fecha = ?',
                    [materia_id, estudiante_id, fecha]
                );
                
                if (existentes.length > 0) {
                    // Actualizar
                    await pool.query(
                        'UPDATE asistencias SET estado = ? WHERE id = ?',
                        [estado, existentes[0].id]
                    );
                } else {
                    // Insertar
                    await pool.query(
                        'INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado) VALUES (?, ?, ?, ?)',
                        [materia_id, estudiante_id, fecha, estado]
                    );
                }
            }
            
            res.json({ message: 'Asistencias guardadas correctamente', count: asistencias.length });
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Obtener estadísticas de asistencia por materia
    async getEstadisticas(req, res) {
        try {
            const { materia_id } = req.params;
            
            // Verificar que la materia pertenece al profesor
            const [materias] = await pool.query(
                'SELECT id, estudiantes FROM materias WHERE id = ? AND profesor_id = ?',
                [materia_id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Obtener estadísticas por fecha
            const [estadisticas] = await pool.query(
                `SELECT 
                    fecha,
                    SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as presentes,
                    SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as ausentes,
                    SUM(CASE WHEN estado = 'retardo' THEN 1 ELSE 0 END) as retardos,
                    COUNT(*) as total
                 FROM asistencias
                 WHERE materia_id = ?
                 GROUP BY fecha
                 ORDER BY fecha DESC`,
                [materia_id]
            );
            
            // Totales generales
            const [totales] = await pool.query(
                `SELECT 
                    SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as total_presentes,
                    SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as total_ausentes,
                    SUM(CASE WHEN estado = 'retardo' THEN 1 ELSE 0 END) as total_retardos,
                    COUNT(DISTINCT fecha) as total_clases
                 FROM asistencias
                 WHERE materia_id = ?`,
                [materia_id]
            );
            
            res.json({
                totales: totales[0],
                por_fecha: estadisticas
            });
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = asistenciaController;