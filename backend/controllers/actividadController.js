const pool = require('../database/connection');

const actividadController = {
    // Obtener todas las actividades del profesor
    async getAll(req, res) {
        try {
            const { materia_id } = req.query;
            
            let query = `
                SELECT a.*, m.nombre as materia_nombre, m.color 
                FROM actividades a
                JOIN materias m ON a.materia_id = m.id
                WHERE m.profesor_id = ?
            `;
            const params = [req.profesor.id];
            
            if (materia_id) {
                query += ' AND a.materia_id = ?';
                params.push(materia_id);
            }
            
            query += ' ORDER BY a.fecha_entrega';
            
            const [actividades] = await pool.query(query, params);
            res.json(actividades);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Obtener una actividad por ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            
            const [actividades] = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = ? AND m.profesor_id = ?`,
                [id, req.profesor.id]
            );
            
            if (actividades.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }
            
            res.json(actividades[0]);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Crear nueva actividad
    async create(req, res) {
        try {
            const { materia_id, tipo, titulo, descripcion, fecha_entrega, valor } = req.body;
            
            // Verificar que la materia pertenece al profesor
            const [materias] = await pool.query(
                'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                [materia_id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            const [result] = await pool.query(
                `INSERT INTO actividades 
                 (materia_id, tipo, titulo, descripcion, fecha_entrega, valor) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [materia_id, tipo, titulo, descripcion, fecha_entrega, valor || 100]
            );
            
            const [nuevaActividad] = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = ?`,
                [result.insertId]
            );
            
            res.status(201).json(nuevaActividad[0]);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Actualizar actividad
    async update(req, res) {
        try {
            const { id } = req.params;
            const { tipo, titulo, descripcion, fecha_entrega, valor } = req.body;
            
            // Verificar propiedad
            const [actividades] = await pool.query(
                `SELECT a.id FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = ? AND m.profesor_id = ?`,
                [id, req.profesor.id]
            );
            
            if (actividades.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }
            
            await pool.query(
                `UPDATE actividades 
                 SET tipo = ?, titulo = ?, descripcion = ?, fecha_entrega = ?, valor = ?
                 WHERE id = ?`,
                [tipo, titulo, descripcion, fecha_entrega, valor, id]
            );
            
            const [actividadActualizada] = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = ?`,
                [id]
            );
            
            res.json(actividadActualizada[0]);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Eliminar actividad
    async delete(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar propiedad
            const [actividades] = await pool.query(
                `SELECT a.id FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = ? AND m.profesor_id = ?`,
                [id, req.profesor.id]
            );
            
            if (actividades.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }
            
            await pool.query('DELETE FROM actividades WHERE id = ?', [id]);
            
            res.json({ message: 'Actividad eliminada correctamente' });
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = actividadController;