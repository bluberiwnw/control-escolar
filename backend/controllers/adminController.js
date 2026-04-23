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
        return 'No se puede completar la operación porque existen datos relacionados.';
    }
    return fallback;
}

function validarCorreo(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validarNombre(nombre) {
    const limpio = String(nombre || '').trim();
    return limpio.length >= 3 && limpio.length <= 120;
}

function validarMatricula(matricula) {
    return /^[A-Za-z0-9-]{4,20}$/.test(String(matricula || '').trim());
}

function limpiarTextoCorto(valor, max = 120) {
    return String(valor || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validarActividadPayload(payload) {
    const materiaId = parseEnteroSeguro(payload?.materia_id, NaN);
    const tipo = limpiarTextoCorto(payload?.tipo, 20).toLowerCase();
    const titulo = limpiarTextoCorto(payload?.titulo, 120);
    const descripcion = String(payload?.descripcion || '').trim().slice(0, 600);
    const fechaEntrega = String(payload?.fecha_entrega || '').trim();
    const valor = parseEnteroSeguro(payload?.valor, NaN);
    if (!Number.isInteger(materiaId) || materiaId <= 0) {
        return { ok: false, message: 'Selecciona una materia válida.' };
    }
    if (!TIPOS_ACTIVIDAD.has(tipo)) {
        return { ok: false, message: 'El tipo de actividad no es válido.' };
    }
    if (titulo.length < 4 || titulo.length > 120) {
        return { ok: false, message: 'El título debe tener entre 4 y 120 caracteres.' };
    }
    if (descripcion.length > 600) {
        return { ok: false, message: 'La descripción no puede exceder 600 caracteres.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEntrega) || Number.isNaN(Date.parse(fechaEntrega))) {
        return { ok: false, message: 'La fecha de entrega no es válida.' };
    }
    if (!Number.isInteger(valor) || valor < 1 || valor > 100) {
        return { ok: false, message: 'El valor debe ser un número entre 1 y 100.' };
    }
    return {
        ok: true,
        data: { materia_id: materiaId, tipo, titulo, descripcion, fecha_entrega: fechaEntrega, valor },
    };
}

const adminController = {
    // Estadísticas generales
    async getStats(req, res) {
        try {
            const profesores = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol = 'profesor'");
            const administradores = await pool.query("SELECT COUNT(*) FROM usuarios WHERE rol = 'administrador'");
            const estudiantes = await pool.query('SELECT COUNT(*) FROM estudiantes');
            const materias = await pool.query('SELECT COUNT(*) FROM materias');
            const actividades = await pool.query('SELECT COUNT(*) FROM actividades');
            const alumnosPorAnio = await pool.query(`
                SELECT EXTRACT(YEAR FROM created_at)::int AS anio, COUNT(*)::int AS total
                FROM estudiantes
                WHERE created_at IS NOT NULL
                GROUP BY 1
                ORDER BY 1 DESC
                LIMIT 5
            `);
            res.json({
                profesores: parseInt(profesores.rows[0].count),
                administradores: parseInt(administradores.rows[0].count),
                estudiantes: parseInt(estudiantes.rows[0].count),
                materias: parseInt(materias.rows[0].count),
                actividades: parseInt(actividades.rows[0].count),
                alumnos_por_anio: alumnosPorAnio.rows.reverse()
            });
        } catch (error) {
            res.status(500).json({ message: 'No se pudieron cargar las estadísticas del dashboard.' });
        }
    },

    // Listar usuarios (profesores o estudiantes)
    async listarUsuarios(req, res) {
        try {
            const { rol } = req.query;
            console.log(`Listando usuarios con rol: ${rol}`);
            
            if (rol === 'profesor') {
                const query = 'SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE rol IN ($1, $2) ORDER BY nombre';
                const result = await pool.query(query, ['profesor', 'administrador']);
                console.log(`Profesores encontrados: ${result.rows.length}`);
                res.json(result.rows);
            } else if (rol === 'alumno') {
                const query = 'SELECT id, matricula, nombre, COALESCE(anio, 0) as anio, email, activo, created_at FROM estudiantes ORDER BY nombre';
                const result = await pool.query(query);
                console.log(`Estudiantes encontrados: ${result.rows.length}`);
                res.json(result.rows);
            } else {
                console.log('Rol no válido:', rol);
                res.status(400).json({ error: 'Rol no válido' });
            }
        } catch (error) {
            console.error('Error en listarUsuarios:', error);
            res.status(500).json({ 
                error: 'Error al cargar usuarios', 
                message: 'No se pudieron cargar los usuarios. Intenta de nuevo.' 
            });
        }
    },

    // Crear profesor (usuario)
    async crearProfesor(req, res) {
        try {
            const { nombre, email, password, rol } = req.body;
            if (!validarNombre(nombre)) {
                return res.status(400).json({ message: 'El nombre debe tener entre 3 y 120 caracteres.' });
            }
            if (!validarCorreo(email)) {
                return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
            }
            if (String(password || '').length < 6) {
                return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
            }
            if (rol && !['profesor', 'administrador'].includes(rol)) {
                return res.status(400).json({ message: 'El rol indicado no es válido.' });
            }
            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync(password, 10);
            const result = await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol, activo) VALUES ($1, $2, $3, $4, true) RETURNING id',
                [nombre, email, hashedPassword, rol || 'profesor']
            );
            res.status(201).json({ id: result.rows[0].id, message: 'Profesor creado' });
        } catch (error) {
            res.status(500).json({ message: errorUsuario(error, 'No se pudo crear el profesor.') });
        }
    },

    // Crear estudiante
    async crearEstudiante(req, res) {
        try {
            const { matricula, nombre, anio, email, password } = req.body;
            
            // Generar matrícula automáticamente si no se proporciona
            let matriculaFinal = matricula;
            if (!matricula) {
                const year = new Date().getFullYear();
                const randomNum = Math.floor(Math.random() * 9000) + 1000;
                matriculaFinal = `${year}-${randomNum}`;
            }
            
            if (matricula && !validarMatricula(matricula)) {
                return res.status(400).json({ message: 'La matrícula debe contener entre 4 y 20 caracteres válidos.' });
            }
            if (!validarNombre(nombre)) {
                return res.status(400).json({ message: 'El nombre debe tener entre 3 y 120 caracteres.' });
            }
            if (!anio || anio < 1 || anio > 6) {
                return res.status(400).json({ message: 'El año debe estar entre 1 y 6.' });
            }
            if (!validarCorreo(email)) {
                return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
            }
            if (String(password || '').length < 6) {
                return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
            }
            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync(password, 10);
            const result = await pool.query(
                'INSERT INTO estudiantes (matricula, nombre, anio, email, password, activo) VALUES ($1, $2, $3, $4, $5, true) RETURNING id',
                [matriculaFinal, nombre, anio, email, hashedPassword]
            );
            res.status(201).json({ id: result.rows[0].id, message: 'Estudiante creado' });
        } catch (error) {
            res.status(500).json({ message: errorUsuario(error, 'No se pudo crear el estudiante.') });
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

    async actualizarProfesor(req, res) {
        try {
            const { id } = req.params;
            const { nombre, email } = req.body;
            if (!validarNombre(nombre)) {
                return res.status(400).json({ message: 'El nombre debe tener entre 3 y 120 caracteres.' });
            }
            if (!validarCorreo(email)) {
                return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
            }
            await pool.query(
                'UPDATE usuarios SET nombre = $1, email = $2 WHERE id = $3 AND rol IN ($4, $5)',
                [nombre, email, id, 'profesor', 'administrador']
            );
            res.json({ message: 'Profesor actualizado' });
        } catch (error) {
            res.status(500).json({ message: errorUsuario(error, 'No se pudo actualizar el profesor.') });
        }
    },

    async actualizarEstudiante(req, res) {
        try {
            const { id } = req.params;
            const { matricula, nombre, email } = req.body;
            if (!validarMatricula(matricula)) {
                return res.status(400).json({ message: 'La matrícula debe contener entre 4 y 20 caracteres válidos.' });
            }
            if (!validarNombre(nombre)) {
                return res.status(400).json({ message: 'El nombre debe tener entre 3 y 120 caracteres.' });
            }
            if (!validarCorreo(email)) {
                return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
            }
            await pool.query(
                'UPDATE estudiantes SET matricula = $1, nombre = $2, email = $3 WHERE id = $4',
                [matricula, nombre, email, id]
            );
            res.json({ message: 'Estudiante actualizado' });
        } catch (error) {
            res.status(500).json({ message: errorUsuario(error, 'No se pudo actualizar el estudiante.') });
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

    async crearMateria(req, res) {
        try {
            const { nombre, clave, horario, estudiantes, bajas, promedio, semestre, profesor_id } = req.body;
            const alumnosRegistrados = parseEnteroSeguro(estudiantes, 0);
            const totalBajas = parseEnteroSeguro(bajas, 0);
            const promedioMateria = parseDecimalSeguro(promedio, 0);
            if (!validarNombre(nombre)) {
                return res.status(400).json({ message: 'El nombre de la materia debe tener entre 3 y 120 caracteres.' });
            }
            if (!/^[A-Za-z0-9-]{3,20}$/.test(String(clave || '').trim())) {
                return res.status(400).json({ message: 'La clave debe tener entre 3 y 20 caracteres válidos.' });
            }
            if (!String(horario || '').trim() || !String(semestre || '').trim()) {
                return res.status(400).json({ message: 'Completa los campos obligatorios de horario y semestre.' });
            }
            if (alumnosRegistrados < 0 || totalBajas < 0 || totalBajas > alumnosRegistrados) {
                return res.status(400).json({ message: 'Los valores de estudiantes y bajas no son válidos.' });
            }
            if (promedioMateria < 0 || promedioMateria > 10) {
                return res.status(400).json({ message: 'El promedio debe estar entre 0 y 10.' });
            }
            const r = await pool.query(
                `INSERT INTO materias (nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [
                    nombre,
                    clave,
                    horario || '',
                    alumnosRegistrados,
                    totalBajas,
                    promedioMateria,
                    semestre || '',
                    'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                    profesor_id || null,
                ]
            );
            res.status(201).json({ id: r.rows[0].id, message: 'Materia creada' });
        } catch (error) {
            res.status(500).json({ message: errorUsuario(error, 'No se pudo crear la materia.') });
        }
    },

    async actualizarMateria(req, res) {
        try {
            const { id } = req.params;
            const { nombre, clave, horario, estudiantes, bajas, promedio, semestre, profesor_id } = req.body;
            const alumnosRegistrados = parseEnteroSeguro(estudiantes, 0);
            const totalBajas = parseEnteroSeguro(bajas, 0);
            const promedioMateria = parseDecimalSeguro(promedio, 0);
            if (!validarNombre(nombre)) {
                return res.status(400).json({ message: 'El nombre de la materia debe tener entre 3 y 120 caracteres.' });
            }
            if (!/^[A-Za-z0-9-]{3,20}$/.test(String(clave || '').trim())) {
                return res.status(400).json({ message: 'La clave debe tener entre 3 y 20 caracteres válidos.' });
            }
            if (!String(horario || '').trim() || !String(semestre || '').trim()) {
                return res.status(400).json({ message: 'Completa los campos obligatorios de horario y semestre.' });
            }
            if (alumnosRegistrados < 0 || totalBajas < 0 || totalBajas > alumnosRegistrados) {
                return res.status(400).json({ message: 'Los valores de estudiantes y bajas no son válidos.' });
            }
            if (promedioMateria < 0 || promedioMateria > 10) {
                return res.status(400).json({ message: 'El promedio debe estar entre 0 y 10.' });
            }
            await pool.query(
                `UPDATE materias SET nombre=$1, clave=$2, horario=$3, estudiantes=$4, bajas=$5, promedio=$6, semestre=$7, color=$8, profesor_id=$9
                 WHERE id=$10`,
                [
                    nombre,
                    clave,
                    horario,
                    alumnosRegistrados,
                    totalBajas,
                    promedioMateria,
                    semestre,
                    'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                    profesor_id || null,
                    id,
                ]
            );
            res.json({ message: 'Materia actualizada' });
        } catch (error) {
            res.status(500).json({ message: errorUsuario(error, 'No se pudo actualizar la materia.') });
        }
    },

    async crearActividad(req, res) {
        try {
            const validacion = validarActividadPayload(req.body);
            if (!validacion.ok) {
                return res.status(400).json({ message: validacion.message });
            }
            const { materia_id, tipo, titulo, descripcion, fecha_entrega, valor } = validacion.data;
            const materiaCheck = await pool.query('SELECT id FROM materias WHERE id = $1', [materia_id]);
            if (materiaCheck.rowCount === 0) {
                return res.status(404).json({ message: 'La materia indicada no existe.' });
            }
            const r = await pool.query(
                `INSERT INTO actividades (materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [materia_id, tipo, titulo, descripcion, fecha_entrega, valor]
            );
            res.status(201).json({ id: r.rows[0].id, message: 'Actividad creada' });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo crear la actividad.' });
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
            res.status(500).json({ message: 'No se pudieron cargar las actividades.' });
        }
    },

    // Eliminar actividad
    async eliminarActividad(req, res) {
        try {
            const { id } = req.params;
            const idActividad = parseEnteroSeguro(id, NaN);
            if (!Number.isInteger(idActividad) || idActividad <= 0) {
                return res.status(400).json({ message: 'ID de actividad no válido.' });
            }
            const result = await pool.query('DELETE FROM actividades WHERE id = $1', [idActividad]);
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada.' });
            }
            res.json({ message: 'Actividad eliminada' });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo eliminar la actividad.' });
        }
    },

    // Listar asistencias con filtros
    async listarAsistencias(req, res) {
    try {
        const { fecha, materia_id, todas } = req.query;
        let query = `
            SELECT a.id, a.materia_id, a.estudiante_id, a.fecha, a.estado,
                   m.nombre as materia_nombre, e.nombre as estudiante_nombre
            FROM asistencias a
            JOIN materias m ON a.materia_id = m.id
            JOIN estudiantes e ON a.estudiante_id = e.id
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;
        if (fecha && String(todas) !== 'true') {
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

    async actualizarCalificacion(req, res) {
        try {
            const { id } = req.params;
            const { calificacion } = req.body;
            const valor = parseDecimalSeguro(calificacion, NaN);
            if (Number.isNaN(valor) || valor < 5 || valor > 10) {
                return res.status(400).json({ message: 'La calificación debe estar entre 5 y 10.' });
            }
            await pool.query(
                'UPDATE calificaciones SET calificacion = $1 WHERE id = $2',
                [valor, id]
            );
            res.json({ message: 'Calificacion actualizada' });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo actualizar la calificación.' });
        }
    },

    async eliminarCalificacion(req, res) {
        try {
            const { id } = req.params;
            const result = await pool.query('DELETE FROM calificaciones WHERE id = $1', [id]);
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'La calificación ya no existe.' });
            }
            res.json({ message: 'Calificación eliminada correctamente.' });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo eliminar la calificación.' });
        }
    },

    // Reportes globales
    async getReportes(req, res) {
        try {
            // Promedio general de calificaciones
            const promedio = await pool.query('SELECT AVG(calificacion) as promedio FROM calificaciones');
            const rendimientoSobresaliente = await pool.query(`
                SELECT 
                    (COUNT(CASE WHEN calificacion >= 8 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) as porcentaje 
                FROM calificaciones
            `);
            const materiasRendimiento = await pool.query(`
                SELECT m.nombre, AVG(c.calificacion) as promedio
                FROM calificaciones c
                JOIN materias m ON c.materia_id = m.id
                GROUP BY m.id, m.nombre
                ORDER BY promedio DESC
            `);
            res.json({
                promedio_general: parseFloat(promedio.rows[0].promedio) || 0,
                porcentaje_sobresaliente: parseFloat(rendimientoSobresaliente.rows[0].porcentaje) || 0,
                materias_rendimiento: materiasRendimiento.rows
            });
        } catch (error) {
            res.status(500).json({ message: 'No se pudieron generar los reportes.' });
        }
    },

    // Obtener una actividad por ID (para editar)
    async getActividadById(req, res) {
        try {
            const { id } = req.params;
            const idActividad = parseEnteroSeguro(id, NaN);
            if (!Number.isInteger(idActividad) || idActividad <= 0) {
                return res.status(400).json({ message: 'ID de actividad no válido.' });
            }
            const result = await pool.query('SELECT * FROM actividades WHERE id = $1', [idActividad]);
            if (result.rows.length === 0) return res.status(404).json({ message: 'Actividad no encontrada.' });
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'No se pudo obtener la actividad.' });
        }
    },

    // Actualizar actividad
    async updateActividad(req, res) {
        try {
            const { id } = req.params;
            const idActividad = parseEnteroSeguro(id, NaN);
            if (!Number.isInteger(idActividad) || idActividad <= 0) {
                return res.status(400).json({ message: 'ID de actividad no válido.' });
            }
            const validacion = validarActividadPayload(req.body);
            if (!validacion.ok) {
                return res.status(400).json({ message: validacion.message });
            }
            const { titulo, descripcion, fecha_entrega, tipo, valor, materia_id } = validacion.data;
            const materiaCheck = await pool.query('SELECT id FROM materias WHERE id = $1', [materia_id]);
            if (materiaCheck.rowCount === 0) {
                return res.status(404).json({ message: 'La materia indicada no existe.' });
            }
            await pool.query(
                `UPDATE actividades SET materia_id=$1, titulo=$2, descripcion=$3, fecha_entrega=$4, tipo=$5, valor=$6 WHERE id=$7`,
                [materia_id, titulo, descripcion, fecha_entrega, tipo, valor, idActividad]
            );
            res.json({ message: 'Actualizada' });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo actualizar la actividad.' });
        }
    },
    
    // Eliminar asistencia por ID
    async deleteAsistencia(req, res) {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM asistencias WHERE id = $1', [id]);
            res.json({ message: 'Asistencia eliminada' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async actualizarAsistencia(req, res) {
        try {
            const { id } = req.params;
            const { estado } = req.body;
            if (!ESTADOS_ASISTENCIA.has(String(estado || '').trim())) {
                return res.status(400).json({ message: 'El estado de asistencia no es válido.' });
            }
            await pool.query(
                'UPDATE asistencias SET estado = $1 WHERE id = $2',
                [estado, id]
            );
            res.json({ message: 'Asistencia actualizada' });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo actualizar la asistencia.' });
        }
    },

    async listarArchivosCalificaciones(req, res) {
        try {
            const result = await pool.query(
                `SELECT a.*, m.nombre AS materia_nombre, u.nombre AS profesor_nombre
                 FROM archivos_calificaciones a
                 JOIN materias m ON a.materia_id = m.id
                 JOIN usuarios u ON a.profesor_id = u.id
                 ORDER BY a.fecha_subida DESC`
            );
            res.json(
                result.rows.map((row) => ({
                    ...row,
                    archivo_url: `/uploads/${encodeURIComponent(row.nombre_archivo)}`,
                }))
            );
        } catch (error) {
            res.status(500).json({ message: 'No se pudieron cargar los archivos de calificaciones.' });
        }
    },

    async descargarArchivoCalificacionAdmin(req, res) {
        try {
            const id = parseEnteroSeguro(req.params.id, NaN);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ message: 'ID no válido.' });
            }
            const find = await pool.query(
                'SELECT nombre_archivo FROM archivos_calificaciones WHERE id = $1',
                [id]
            );
            if (find.rowCount === 0 || !find.rows[0].nombre_archivo) {
                return res.status(404).json({ message: 'Archivo no encontrado.' });
            }
            const nombre = find.rows[0].nombre_archivo;
            const full = path.join(__dirname, '../uploads', nombre);
            if (!fs.existsSync(full)) {
                return res.status(404).json({ message: 'El archivo ya no está en el servidor.' });
            }
            return res.download(full, nombre);
        } catch (error) {
            res.status(500).json({ message: 'No se pudo descargar el archivo.' });
        }
    },

    async eliminarArchivoCalificacion(req, res) {
        try {
            const { id } = req.params;
            const result = await pool.query(
                'DELETE FROM archivos_calificaciones WHERE id = $1 RETURNING nombre_archivo',
                [id]
            );
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Archivo no encontrado' });
            }
            const fileName = result.rows[0].nombre_archivo;
            const fullPath = path.join(__dirname, '../uploads', fileName);
            if (fs.existsSync(fullPath)) {
                try {
                    fs.unlinkSync(fullPath);
                } catch (_) {
                    /* ignorar si no se puede borrar el archivo físico */
                }
            }
            res.json({ message: 'Archivo eliminado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async listarArchivosEntregas(req, res) {
        try {
            const { materia_id } = req.query;
            const params = [];
            let idx = 1;
            let query = `
                SELECT e.id, e.archivo, e.comentario, e.calificacion, e.actividad_id, e.estudiante_id,
                       a.titulo AS actividad_titulo, a.materia_id,
                       m.nombre AS materia_nombre, s.nombre AS estudiante_nombre
                FROM entregas e
                JOIN actividades a ON e.actividad_id = a.id
                JOIN materias m ON a.materia_id = m.id
                JOIN estudiantes s ON e.estudiante_id = s.id
                WHERE 1=1
            `;
            if (materia_id) {
                query += ` AND a.materia_id = $${idx}`;
                params.push(parseEnteroSeguro(materia_id, 0));
                idx++;
            }
            query += ' ORDER BY m.nombre, a.titulo, s.nombre';
            const result = await pool.query(query, params);
            res.json(
                result.rows.map((row) => ({
                    ...row,
                    archivo_url: row.archivo ? `/uploads/${encodeURIComponent(row.archivo)}` : null,
                }))
            );
        } catch (error) {
            res.status(500).json({ message: 'No se pudieron cargar los archivos de entregas.' });
        }
    },

    async descargarArchivoEntrega(req, res) {
        try {
            const entregaId = parseEnteroSeguro(req.params.id, NaN);
            if (!Number.isInteger(entregaId) || entregaId <= 0) {
                return res.status(400).json({ message: 'ID de entrega no válido.' });
            }
            const find = await pool.query('SELECT archivo FROM entregas WHERE id = $1', [entregaId]);
            if (find.rowCount === 0 || !find.rows[0].archivo) {
                return res.status(404).json({ message: 'Archivo no encontrado.' });
            }
            const archivo = find.rows[0].archivo;
            const full = path.join(__dirname, '../uploads', archivo);
            if (!fs.existsSync(full)) {
                return res.status(404).json({ message: 'El archivo ya no está en el servidor.' });
            }
            return res.download(full, archivo);
        } catch (error) {
            res.status(500).json({ message: 'No se pudo descargar el archivo.' });
        }
    },

    async actualizarArchivoEntrega(req, res) {
        try {
            const { id } = req.params;
            const entregaId = parseEnteroSeguro(id, NaN);
            if (!Number.isInteger(entregaId) || entregaId <= 0) {
                if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'ID de entrega no válido.' });
            }
            const comentario = String(req.body?.comentario || '').trim().slice(0, 500);
            const body = req.body || {};
            const hasCalifKey = Object.prototype.hasOwnProperty.call(body, 'calificacion');
            let updateCalificacion = false;
            let calificacionValor = null;
            if (hasCalifKey) {
                updateCalificacion = true;
                const raw = String(body.calificacion ?? '').trim();
                if (raw === '') {
                    calificacionValor = null;
                } else {
                    const n = Number.parseFloat(raw);
                    if (Number.isNaN(n)) {
                        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                        return res.status(400).json({ message: 'Calificación no válida.' });
                    }
                    calificacionValor = Math.min(100, Math.max(0, n));
                }
            }
            const find = await pool.query('SELECT archivo FROM entregas WHERE id = $1', [entregaId]);
            if (find.rowCount === 0) {
                if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(404).json({ message: 'Entrega no encontrada.' });
            }
            const archivoAnterior = find.rows[0].archivo;
            const nuevoArchivo = req.file ? req.file.filename : archivoAnterior;
            if (updateCalificacion) {
                await pool.query(
                    'UPDATE entregas SET archivo = $1, comentario = $2, calificacion = $3 WHERE id = $4',
                    [nuevoArchivo, comentario, calificacionValor, entregaId]
                );
            } else {
                await pool.query('UPDATE entregas SET archivo = $1, comentario = $2 WHERE id = $3', [nuevoArchivo, comentario, entregaId]);
            }
            if (req.file && archivoAnterior && archivoAnterior !== nuevoArchivo) {
                const full = path.join(__dirname, '../uploads', archivoAnterior);
                if (fs.existsSync(full)) {
                    try {
                        fs.unlinkSync(full);
                    } catch (_) {
                        /* ignore delete error */
                    }
                }
            }
            res.json({ message: 'Entrega actualizada correctamente.' });
        } catch (error) {
            if (req.file?.path && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (_) {
                    /* ignore rollback delete */
                }
            }
            res.status(500).json({ message: 'No se pudo actualizar el archivo de entrega.' });
        }
    },

    async eliminarArchivoEntrega(req, res) {
        try {
            const { id } = req.params;
            const entregaId = parseEnteroSeguro(id, NaN);
            if (!Number.isInteger(entregaId) || entregaId <= 0) {
                return res.status(400).json({ message: 'ID de entrega no válido.' });
            }
            const result = await pool.query('DELETE FROM entregas WHERE id = $1 RETURNING archivo', [entregaId]);
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Entrega no encontrada.' });
            }
            const archivo = result.rows[0]?.archivo;
            if (archivo) {
                const full = path.join(__dirname, '../uploads', archivo);
                if (fs.existsSync(full)) {
                    try {
                        fs.unlinkSync(full);
                    } catch (_) {
                        /* ignore delete error */
                    }
                }
            }
            res.json({ message: 'Archivo de entrega eliminado correctamente.' });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo eliminar el archivo de entrega.' });
        }
    },

    // Actualizar contraseña de usuario (profesor o estudiante)
    async actualizarContraseña(req, res) {
        try {
            const { id } = req.params;
            const { password } = req.body;
            
            if (!password || password.length < 6) {
                return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
            }

            const bcrypt = require('bcryptjs');
            const hashedPassword = bcrypt.hashSync(password, 10);

            // Intentar actualizar en tabla usuarios (profesores)
            const resultProfesor = await pool.query(
                'UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING id',
                [hashedPassword, id]
            );

            // Si no se actualizó en usuarios, intentar en estudiantes
            if (resultProfesor.rowCount === 0) {
                const resultEstudiante = await pool.query(
                    'UPDATE estudiantes SET password = $1 WHERE id = $2 RETURNING id',
                    [hashedPassword, id]
                );

                if (resultEstudiante.rowCount === 0) {
                    return res.status(404).json({ message: 'Usuario no encontrado' });
                }
            }

            res.json({ message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error('Error al actualizar contraseña:', error);
            res.status(500).json({ message: 'Error al actualizar contraseña' });
        }
    },

    // Reportes generales de asistencia para admin
    async getReportesAsistenciaGeneral(req, res) {
        try {
            // Estadísticas generales
            const totales = await pool.query(
                `SELECT 
                    SUM(CASE WHEN a.estado = 'presente' THEN 1 ELSE 0 END) as total_presentes,
                    SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) as total_ausentes,
                    SUM(CASE WHEN a.estado = 'retardo' THEN 1 ELSE 0 END) as total_retardos,
                    COUNT(DISTINCT a.fecha) as total_clases
                 FROM asistencias a`
            );

            // Estadísticas por materia
            const porMateria = await pool.query(
                `SELECT 
                    m.nombre as materia_nombre,
                    SUM(CASE WHEN a.estado = 'presente' THEN 1 ELSE 0 END) as presentes,
                    SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) as ausentes,
                    SUM(CASE WHEN a.estado = 'retardo' THEN 1 ELSE 0 END) as retardos,
                    COUNT(*) as total
                 FROM asistencias a
                 JOIN materias m ON a.materia_id = m.id
                 GROUP BY m.id, m.nombre
                 ORDER BY m.nombre`
            );

            res.json({
                total_clases: totales.rows[0]?.total_clases || 0,
                total_presentes: totales.rows[0]?.total_presentes || 0,
                total_ausentes: totales.rows[0]?.total_ausentes || 0,
                total_retardos: totales.rows[0]?.total_retardos || 0,
                por_materia: porMateria.rows
            });
        } catch (error) {
            console.error('Error al generar reportes generales:', error);
            res.status(500).json({ message: 'Error al generar reportes', error: error.message });
        }
    },
};

module.exports = adminController;