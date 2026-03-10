const pool = require('../database/connection');

const materiaController = {
    // Obtener todas las materias del profesor
    async getAll(req, res) {
        try {
            const [materias] = await pool.query(
                'SELECT * FROM materias WHERE profesor_id = ? ORDER BY nombre',
                [req.profesor.id]
            );
            res.json(materias);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Obtener una materia por ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            
            const [materias] = await pool.query(
                'SELECT * FROM materias WHERE id = ? AND profesor_id = ?',
                [id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            res.json(materias[0]);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Obtener estudiantes de una materia
    async getEstudiantes(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que la materia pertenece al profesor
            const [materias] = await pool.query(
                'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                [id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Obtener estudiantes (simulado - en producción tendrías una tabla de relación)
            const [estudiantes] = await pool.query(
                'SELECT * FROM estudiantes LIMIT 10'
            );
            
            res.json(estudiantes);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Crear nueva materia
    async create(req, res) {
        try {
            const { nombre, clave, horario, estudiantes, bajas, promedio, semestre, color } = req.body;
            
            const [result] = await pool.query(
                `INSERT INTO materias 
                 (nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [nombre, clave, horario, estudiantes || 0, bajas || 0, promedio || 0, semestre, color, req.profesor.id]
            );
            
            const [nuevaMateria] = await pool.query(
                'SELECT * FROM materias WHERE id = ?',
                [result.insertId]
            );
            
            res.status(201).json(nuevaMateria[0]);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Actualizar materia
    async update(req, res) {
        try {
            const { id } = req.params;
            const { nombre, clave, horario, estudiantes, bajas, promedio, semestre, color } = req.body;
            
            // Verificar propiedad
            const [materias] = await pool.query(
                'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                [id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            await pool.query(
                `UPDATE materias 
                 SET nombre = ?, clave = ?, horario = ?, estudiantes = ?, 
                     bajas = ?, promedio = ?, semestre = ?, color = ?
                 WHERE id = ?`,
                [nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, id]
            );
            
            const [materiaActualizada] = await pool.query(
                'SELECT * FROM materias WHERE id = ?',
                [id]
            );
            
            res.json(materiaActualizada[0]);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Eliminar materia
    async delete(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar propiedad
            const [materias] = await pool.query(
                'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                [id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            await pool.query('DELETE FROM materias WHERE id = ?', [id]);
            
            res.json({ message: 'Materia eliminada correctamente' });
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = materiaController;