const pool = require('../database/connection');

const materiaController = {
    async getAll(req, res) {
        try {
            const result = await pool.query(
                'SELECT * FROM materias WHERE profesor_id = $1 ORDER BY nombre',
                [req.usuario.id] // Cambiado de req.profesor.id a req.usuario.id
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getById(req, res) {
        try {
            const { id } = req.params;
            const result = await pool.query(
                'SELECT * FROM materias WHERE id = $1 AND profesor_id = $2',
                [id, req.usuario.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getEstudiantes(req, res) {
        try {
            const { id } = req.params;
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            // Relación entre materias y estudiantes (puedes ajustar según tu esquema)
            const estudiantes = await pool.query('SELECT * FROM estudiantes LIMIT 10');
            res.json(estudiantes.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async create(req, res) {
        try {
            const { nombre, clave, horario, estudiantes, bajas, promedio, semestre, color } = req.body;
            const insertResult = await pool.query(
                `INSERT INTO materias (nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [nombre, clave, horario, estudiantes || 0, bajas || 0, promedio || 0, semestre, color, req.usuario.id]
            );
            const nueva = await pool.query('SELECT * FROM materias WHERE id = $1', [insertResult.rows[0].id]);
            res.status(201).json(nueva.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async update(req, res) {
        try {
            const { id } = req.params;
            const { nombre, clave, horario, estudiantes, bajas, promedio, semestre, color } = req.body;
            const check = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [id, req.usuario.id]
            );
            if (check.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            await pool.query(
                `UPDATE materias 
                 SET nombre = $1, clave = $2, horario = $3, estudiantes = $4, 
                     bajas = $5, promedio = $6, semestre = $7, color = $8
                 WHERE id = $9`,
                [nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, id]
            );
            const actualizada = await pool.query('SELECT * FROM materias WHERE id = $1', [id]);
            res.json(actualizada.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async delete(req, res) {
        try {
            const { id } = req.params;
            const check = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [id, req.usuario.id]
            );
            if (check.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            await pool.query('DELETE FROM materias WHERE id = $1', [id]);
            res.json({ message: 'Materia eliminada correctamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = materiaController;