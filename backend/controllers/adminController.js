const pool = require('../database/connection');
const fs = require('fs');
const path = require('path');

const ESTADOS_ASISTENCIA = new Set(['presente', 'ausente', 'retardo']);
const TIPOS_CALIFICACION = new Set(['tarea', 'proyecto', 'examen']);
const TIPOS_ACTIVIDAD = new Set(['tarea', 'proyecto', 'examen']);

function parseEnteroSeguro(valor, fallback = 0) {
    const numero = Number.parseInt(valor, 10);
    return Number.isNaN(numero) ? fallback : numero;
}

function parseDecimalSeguro(valor, fallback = 0) {
    const numero = Number.parseFloat(valor);
    return Number.isNaN(numero) ? fallback : numero;
}

function errorUsuario(error, fallback) {
    if (error?.code === '23505') {
        if (String(error.constraint).includes('materias_clave')) {
            return 'Ya existe una materia con esa clave. Verifica la información e intenta de nuevo.';
        }
        if (String(error.constraint).includes('usuarios_email') || String(error.constraint).includes('email')) {
            return 'El correo ya está registrado. Usa otro correo electrónico.';
        }
        if (String(error.constraint).includes('matricula')) {
            return 'La matrícula ya está registrada. Verifica el dato capturado.';
        }
        return 'Ya existe un registro con esos datos. Verifica la información e intenta de nuevo.';
    }
    if (error?.code === '23503') {
        if (String(error.constraint).includes('profesor_id')) {
            return 'El profesor seleccionado no existe. Verifica la información.';
        }
        if (String(error.constraint).includes('materia_id')) {
            return 'La materia seleccionada no existe. Verifica la información.';
        }
    }
    if (error?.code === '23502') {
        return 'Falta un campo obligatorio. Verifica que todos los campos requeridos estén completos.';
    }
    if (error?.code === '23514') {
        return 'Uno de los valores ingresados no es válido. Verifica la información.';
    }
    return fallback || 'Error en la base de datos. Inténtalo de nuevo.';
}

const adminController = {
    async getStats(req, res) {
        try {
            const [profesoresResult, estudiantesResult, materiasResult] = await Promise.all([
                pool.query('SELECT COUNT(*) as total FROM usuarios WHERE rol IN (\'profesor\', \'administrador\')'),
                pool.query('SELECT COUNT(*) as total FROM estudiantes'),
                pool.query('SELECT COUNT(*) as total FROM materias')
            ]);

            res.json({
                profesores: parseInt(profesoresResult.rows[0].total),
                estudiantes: parseInt(estudiantesResult.rows[0].total),
                materias: parseInt(materiasResult.rows[0].total)
            });
        } catch (error) {
            console.error('Error en stats:', error);
            res.status(500).json({ error: 'Error al obtener estadísticas' });
        }
    },

    async listarUsuarios(req, res) {
        try {
            const { rol } = req.query;
            let query = 'SELECT id, nombre, email, rol, created_at FROM usuarios';
            const params = [];

            if (rol) {
                query += ' WHERE rol = $1';
                params.push(rol);
            }

            query += ' ORDER BY nombre';

            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('Error listando usuarios:', error);
            res.status(500).json({ error: 'Error al listar usuarios' });
        }
    },

    async crearProfesor(req, res) {
        try {
            const { nombre, email, password, especialidad } = req.body;

            if (!nombre || !email || !password) {
                return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
            }

            const result = await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol, created_at',
                [nombre, email, password, 'profesor']
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error creando profesor:', error);
            res.status(500).json({ error: errorUsuario(error, 'Error al crear profesor') });
        }
    },

    async crearEstudiante(req, res) {
        try {
            const { nombre, email, password, matricula, anio, materia_id } = req.body;

            if (!nombre || !email || !matricula) {
                return res.status(400).json({ error: 'Nombre, email y matrícula son obligatorios' });
            }

            const result = await pool.query(
                'INSERT INTO estudiantes (nombre, email, password, matricula, anio, materia_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, email, matricula, anio, materia_id, created_at',
                [nombre, email, password || '', matricula, anio || 1, materia_id || null]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error creando estudiante:', error);
            res.status(500).json({ error: errorUsuario(error, 'Error al crear estudiante') });
        }
    },

    async actualizarProfesor(req, res) {
        try {
            const { id } = req.params;
            const { nombre, email, password, especialidad } = req.body;

            if (!nombre || !email) {
                return res.status(400).json({ error: 'Nombre y email son obligatorios' });
            }

            let query = 'UPDATE usuarios SET nombre = $1, email = $2';
            const params = [nombre, email];
            
            if (password) {
                query += ', password = $4';
                params.push(password);
            }
            
            query += ' WHERE id = $' + (params.length + 1) + ' RETURNING id, nombre, email, rol, updated_at';
            params.push(id);

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Profesor no encontrado' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error actualizando profesor:', error);
            res.status(500).json({ error: errorUsuario(error, 'Error al actualizar profesor') });
        }
    },

    async actualizarEstudiante(req, res) {
        try {
            const { id } = req.params;
            const { nombre, email, password, matricula, anio, materia_id } = req.body;

            if (!nombre || !email || !matricula) {
                return res.status(400).json({ error: 'Nombre, email y matrícula son obligatorios' });
            }

            let query = 'UPDATE estudiantes SET nombre = $1, email = $2, matricula = $3, anio = $4, materia_id = $5';
            const params = [nombre, email, matricula, anio || 1, materia_id || null];
            
            if (password) {
                query += ', password = $6';
                params.push(password);
            }
            
            query += ' WHERE id = $' + (params.length + 1) + ' RETURNING id, nombre, email, matricula, anio, materia_id, updated_at';
            params.push(id);

            const result = await pool.query(query, params);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Estudiante no encontrado' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error actualizando estudiante:', error);
            res.status(500).json({ error: errorUsuario(error, 'Error al actualizar estudiante') });
        }
    },

    async actualizarContraseña(req, res) {
        try {
            const { id } = req.params;
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ error: 'La contraseña es obligatoria' });
            }

            const result = await pool.query(
                'UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING id',
                [password, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            res.json({ message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error('Error actualizando contraseña:', error);
            res.status(500).json({ error: 'Error al actualizar contraseña' });
        }
    },

    async eliminarUsuario(req, res) {
        try {
            const { id, tipo } = req.params;

            let query;
            if (tipo === 'profesor') {
                query = 'DELETE FROM usuarios WHERE id = $1 AND rol = \'profesor\'';
            } else if (tipo === 'estudiante') {
                query = 'DELETE FROM estudiantes WHERE id = $1';
            } else {
                return res.status(400).json({ error: 'Tipo de usuario no válido' });
            }

            const result = await pool.query(query, [id]);

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            res.json({ message: 'Usuario eliminado correctamente' });
        } catch (error) {
            console.error('Error eliminando usuario:', error);
            res.status(500).json({ error: 'Error al eliminar usuario' });
        }
    },

    async listarMaterias(req, res) {
        try {
            const result = await pool.query(`
                SELECT m.*, p.nombre as profesor_nombre 
                FROM materias m 
                LEFT JOIN usuarios p ON m.profesor_id = p.id 
                ORDER BY m.nombre
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('Error listando materias:', error);
            res.status(500).json({ error: 'Error al listar materias' });
        }
    },

    async crearMateria(req, res) {
        try {
            const { nombre, clave, descripcion, horario, profesor_id, semestre, estudiantes, promedio, bajas } = req.body;

            if (!nombre || !clave) {
                return res.status(400).json({ error: 'Nombre y clave son obligatorios' });
            }

            const result = await pool.query(
                'INSERT INTO materias (nombre, clave, descripcion, horario, profesor_id, semestre, estudiantes, promedio, bajas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
                [nombre, clave, descripcion || '', horario || '', profesor_id || null, semestre || '', estudiantes || 0, promedio || 0, bajas || 0]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error creando materia:', error);
            res.status(500).json({ error: errorUsuario(error, 'Error al crear materia') });
        }
    },

    async actualizarMateria(req, res) {
        try {
            const { id } = req.params;
            const { nombre, clave, descripcion, horario, profesor_id, semestre, estudiantes, promedio, bajas } = req.body;

            if (!nombre || !clave) {
                return res.status(400).json({ error: 'Nombre y clave son obligatorios' });
            }

            const result = await pool.query(
                'UPDATE materias SET nombre = $1, clave = $2, descripcion = $3, horario = $4, profesor_id = $5, semestre = $6, estudiantes = $7, promedio = $8, bajas = $9 WHERE id = $10 RETURNING *',
                [nombre, clave, descripcion || '', horario || '', profesor_id || null, semestre || '', estudiantes || 0, promedio || 0, bajas || 0, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Materia no encontrada' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error actualizando materia:', error);
            res.status(500).json({ error: errorUsuario(error, 'Error al actualizar materia') });
        }
    },

    async eliminarMateria(req, res) {
        try {
            const { id } = req.params;

            const result = await pool.query('DELETE FROM materias WHERE id = $1', [id]);

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Materia no encontrada' });
            }

            res.json({ message: 'Materia eliminada correctamente' });
        } catch (error) {
            console.error('Error eliminando materia:', error);
            res.status(500).json({ error: 'Error al eliminar materia' });
        }
    },

    // Funciones para actividades (placeholder)
    async listarActividades(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al listar actividades' });
        }
    },

    async crearActividad(req, res) {
        try {
            res.status(201).json({ message: 'Actividad creada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al crear actividad' });
        }
    },

    async getActividadById(req, res) {
        try {
            res.json({});
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener actividad' });
        }
    },

    async updateActividad(req, res) {
        try {
            res.json({ message: 'Actividad actualizada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar actividad' });
        }
    },

    async eliminarActividad(req, res) {
        try {
            res.json({ message: 'Actividad eliminada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar actividad' });
        }
    },

    // Funciones para asistencias
    async getReportesAsistenciaGeneral(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener reportes de asistencia' });
        }
    },

    async listarAsistencias(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al listar asistencias' });
        }
    },

    async exportarAsistenciasCSV(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al exportar asistencias CSV' });
        }
    },

    async exportarAsistenciasExcel(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al exportar asistencias Excel' });
        }
    },

    async exportarAsistenciasPDF(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al exportar asistencias PDF' });
        }
    },

    async reporteAsistenciaPorCurso(req, res) {
        try {
            res.json({});
        } catch (error) {
            res.status(500).json({ error: 'Error al generar reporte de asistencia por curso' });
        }
    },

    // Funciones para calificaciones
    async listarCalificaciones(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al listar calificaciones' });
        }
    },

    async actualizarCalificacion(req, res) {
        try {
            res.json({ message: 'Calificación actualizada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar calificación' });
        }
    },

    async eliminarCalificacion(req, res) {
        try {
            res.json({ message: 'Calificación eliminada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar calificación' });
        }
    },

    // Funciones para reportes
    async getReportes(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener reportes' });
        }
    },

    // Funciones adicionales placeholder
    async deleteAsistencia(req, res) {
        try {
            res.json({ message: 'Asistencia eliminada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar asistencia' });
        }
    },

    async actualizarAsistencia(req, res) {
        try {
            res.json({ message: 'Asistencia actualizada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar asistencia' });
        }
    },

    async listarArchivosCalificaciones(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al listar archivos de calificaciones' });
        }
    },

    async descargarArchivoCalificacionAdmin(req, res) {
        try {
            res.json({ message: 'Descarga de archivo' });
        } catch (error) {
            res.status(500).json({ error: 'Error al descargar archivo' });
        }
    },

    async eliminarArchivoCalificacion(req, res) {
        try {
            res.json({ message: 'Archivo eliminado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar archivo' });
        }
    },

    async listarArchivosEntregas(req, res) {
        try {
            res.json([]);
        } catch (error) {
            res.status(500).json({ error: 'Error al listar archivos de entregas' });
        }
    },

    async descargarArchivoEntrega(req, res) {
        try {
            res.json({ message: 'Descarga de entrega' });
        } catch (error) {
            res.status(500).json({ error: 'Error al descargar entrega' });
        }
    },

    async actualizarArchivoEntrega(req, res) {
        try {
            res.json({ message: 'Entrega actualizada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar entrega' });
        }
    },

    async eliminarArchivoEntrega(req, res) {
        try {
            res.json({ message: 'Entrega eliminada' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar entrega' });
        }
    },

    // Nuevo endpoint para obtener alumnos de una materia
    async getAlumnosDeMateria(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que la materia existe
            const materiaCheck = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1',
                [id]
            );
            
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Obtener alumnos inscritos en la materia
            const alumnosQuery = `
                SELECT 
                    e.id,
                    e.matricula,
                    e.nombre,
                    e.email,
                    e.anio,
                    e.created_at
                FROM estudiantes e
                WHERE e.materia_id = $1
                ORDER BY e.nombre
            `;
            
            const alumnosResult = await pool.query(alumnosQuery, [id]);
            
            res.json({
                materia: materiaCheck.rows[0],
                alumnos: alumnosResult.rows,
                total: alumnosResult.rows.length
            });
            
        } catch (error) {
            console.error('Error al obtener alumnos de la materia:', error);
            res.status(500).json({ 
                message: 'Error al obtener alumnos de la materia',
                error: error.message 
            });
        }
    }
};

module.exports = adminController;
