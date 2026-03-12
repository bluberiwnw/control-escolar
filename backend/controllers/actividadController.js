const pool = require('../database/connection');

const actividadController = {
    async getAll(req, res) {
        try {
            const { materia_id } = req.query;

            let query = `
                SELECT a.*, m.nombre as materia_nombre, m.color 
                FROM actividades a
                JOIN materias m ON a.materia_id = m.id
                WHERE m.profesor_id = $1
            `;
            const params = [req.profesor.id];
            let paramIndex = 2;

            if (materia_id) {
                query += ` AND a.materia_id = $${paramIndex}`;
                params.push(materia_id);
                paramIndex++;
            }

            query += ' ORDER BY a.fecha_entrega';

            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getById(req, res) {
        try {
            const { id } = req.params;

            const result = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1 AND m.profesor_id = $2`,
                [id, req.profesor.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async create(req, res) {
        try {
            const { materia_id, tipo, titulo, descripcion, fecha_entrega, valor } = req.body;

            // Verificar que la materia pertenece al profesor
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.profesor.id]
            );

            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }

            const insertResult = await pool.query(
                `INSERT INTO actividades (materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [materia_id, tipo, titulo, descripcion, fecha_entrega, valor || 100]
            );

            const nuevaActividad = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1`,
                [insertResult.rows[0].id]
            );

            res.status(201).json(nuevaActividad.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async update(req, res) {
        try {
            const { id } = req.params;
            const { tipo, titulo, descripcion, fecha_entrega, valor } = req.body;

            // Verificar propiedad
            const check = await pool.query(
                `SELECT a.id FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1 AND m.profesor_id = $2`,
                [id, req.profesor.id]
            );

            if (check.rows.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }

            await pool.query(
                `UPDATE actividades 
                 SET tipo = $1, titulo = $2, descripcion = $3, fecha_entrega = $4, valor = $5
                 WHERE id = $6`,
                [tipo, titulo, descripcion, fecha_entrega, valor, id]
            );

            const actividadActualizada = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1`,
                [id]
            );

            res.json(actividadActualizada.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async delete(req, res) {
        try {
            const { id } = req.params;

            const check = await pool.query(
                `SELECT a.id FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1 AND m.profesor_id = $2`,
                [id, req.profesor.id]
            );

            if (check.rows.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }

            await pool.query('DELETE FROM actividades WHERE id = $1', [id]);

            res.json({ message: 'Actividad eliminada correctamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = actividadController;