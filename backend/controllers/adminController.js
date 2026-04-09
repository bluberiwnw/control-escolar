const pool = require('../database/connection');

const adminController = {
    // Estadísticas generales
    async getStats(req, res) {
        try {
            const profesores = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol = 'profesor'");
            const administradores = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol = 'administrador'");
            const estudiantes = await pool.query('SELECT COUNT(*) FROM estudiantes');
            const materias = await pool.query('SELECT COUNT(*) FROM materias');
            const actividades = await pool.query('SELECT COUNT(*) FROM actividades');
            res.json({
                profesores: parseInt(profesores.rows[0].count),
                administradores: parseInt(administradores.rows[0].count),
                estudiantes: parseInt(estudiantes.rows[0].count),
                materias: parseInt(materias.rows[0].count),
                actividades: parseInt(actividades.rows[0].count)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Listar usuarios (profesores o estudiantes)
    async listarUsuarios(req, res) {
        try {
            const { rol } = req.query;
            let query = '';
            if (rol === 'profesor') {
                query = 'SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE rol IN ($1, $2) ORDER BY nombre';
                const result = await pool.query(query, ['profesor', 'administrador']);
                res.json(result.rows);
            } else if (rol === 'alumno') {
                query = 'SELECT id, matricula, nombre, email, activo, created_at FROM estudiantes ORDER BY nombre';
                const result = await pool.query(query);
                res.json(result.rows);
            } else {
                res.status(400).json({ error: 'Rol no válido' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Crear profesor (usuario)
    async crearProfesor(req, res) {
        try {
            const { nombre, email, password, rol } = req.body;
            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync(password, 10);
            const result = await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol, activo) VALUES ($1, $2, $3, $4, true) RETURNING id',
                [nombre, email, hashedPassword, rol || 'profesor']
            );
            res.status(201).json({ id: result.rows[0].id, message: 'Profesor creado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Crear estudiante
    async crearEstudiante(req, res) {
        try {
            const { matricula, nombre, email, password } = req.body;
            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync(password, 10);
            const result = await pool.query(
                'INSERT INTO estudiantes (matricula, nombre, email, password, activo) VALUES ($1, $2, $3, $4, true) RETURNING id',
                [matricula, nombre, email, hashedPassword]
            );
            res.status(201).json({ id: result.rows[0].id, message: 'Estudiante creado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Eliminar usuario (profesor o estudiante)
    async eliminarUsuario(req, res) {
        try {
            const { id, tipo } = req.params;
            if (tipo === 'profesor') {
                await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
            } else if (tipo === 'alumno') {
                await pool.query('DELETE FROM estudiantes WHERE id = $1', [id]);
            } else {
                return res.status(400).json({ error: 'Tipo no válido' });
            }
            res.json({ message: 'Usuario eliminado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Listar todas las materias (con nombre del profesor)
    async listarMaterias(req, res) {
        try {
            const result = await pool.query(`
                SELECT m.*, u.nombre as profesor_nombre 
                FROM materias m
                LEFT JOIN usuarios u ON m.profesor_id = u.id
                ORDER BY m.nombre
            `);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Eliminar materia
    async eliminarMateria(req, res) {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM materias WHERE id = $1', [id]);
            res.json({ message: 'Materia eliminada' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Listar todas las actividades (con nombre de materia)
    async listarActividades(req, res) {
        try {
            const result = await pool.query(`
                SELECT a.*, m.nombre as materia_nombre 
                FROM actividades a
                JOIN materias m ON a.materia_id = m.id
                ORDER BY a.fecha_entrega DESC
            `);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Eliminar actividad
    async eliminarActividad(req, res) {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM actividades WHERE id = $1', [id]);
            res.json({ message: 'Actividad eliminada' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Listar asistencias con filtros
    async listarAsistencias(req, res) {
        try {
            const { fecha, materia_id } = req.query;
            let query = `
                SELECT a.*, m.nombre as materia_nombre, e.nombre as estudiante_nombre 
                FROM asistencias a
                JOIN materias m ON a.materia_id = m.id
                JOIN estudiantes e ON a.estudiante_id = e.id
                WHERE 1=1
            `;
            const params = [];
            let idx = 1;
            if (fecha) {
                query += ` AND a.fecha = $${idx}`;
                params.push(fecha);
                idx++;
            }
            if (materia_id) {
                query += ` AND a.materia_id = $${idx}`;
                params.push(materia_id);
                idx++;
            }
            query += ' ORDER BY a.fecha DESC, m.nombre, e.nombre';
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Listar calificaciones con filtros
    async listarCalificaciones(req, res) {
        try {
            const { materia_id } = req.query;
            let query = `
                SELECT c.*, m.nombre as materia_nombre, e.nombre as estudiante_nombre, a.titulo as actividad_titulo
                FROM calificaciones c
                JOIN materias m ON c.materia_id = m.id
                JOIN estudiantes e ON c.estudiante_id = e.id
                LEFT JOIN actividades a ON c.actividad_id = a.id
                WHERE 1=1
            `;
            const params = [];
            if (materia_id) {
                query += ` AND c.materia_id = $1`;
                params.push(materia_id);
            }
            query += ' ORDER BY m.nombre, e.nombre, c.fecha_registro DESC';
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Reportes globales
    async getReportes(req, res) {
        try {
            // Promedio general de calificaciones
            const promedio = await pool.query('SELECT AVG(calificacion) as promedio FROM calificaciones');
            // Porcentaje de aprobación (calificación >= 6)
            const aprobacion = await pool.query(`
                SELECT 
                    (COUNT(CASE WHEN calificacion >= 6 THEN 1 END) * 100.0 / COUNT(*)) as porcentaje 
                FROM calificaciones
            `);
            // Top materias con mejor promedio
            const topMaterias = await pool.query(`
                SELECT m.nombre, AVG(c.calificacion) as promedio
                FROM calificaciones c
                JOIN materias m ON c.materia_id = m.id
                GROUP BY m.id, m.nombre
                ORDER BY promedio DESC
                LIMIT 5
            `);
            res.json({
                promedio_general: parseFloat(promedio.rows[0].promedio) || 0,
                aprobacion_global: parseFloat(aprobacion.rows[0].porcentaje) || 0,
                top_materias: topMaterias.rows
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = adminController;