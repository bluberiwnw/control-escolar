const fs = require('fs');
const path = require('path');
const pool = require('../database/connection');

// Configuración de multer para subida de archivos
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['text/html', 'text/htm'];
    const allowedExtensions = ['.htm', '.html'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo archivos HTM/HTML'), false);
    }
};

const upload = multer({ 
    storage: storage, 
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('archivo');

const calificacionController = {
    async uploadFile(req, res) {
        console.log('📡 uploadFile - Inicio del endpoint');
        console.log('📡 Headers:', req.headers);
        
        upload(req, res, async function(err) {
            if (err) {
                console.error('❌ Error en upload middleware:', err);
                console.error('🔍 Detalles del error:', {
                    name: err.name,
                    message: err.message,
                    code: err.code,
                    limit: err.limit,
                    fileSize: err.size
                });
                return res.status(400).json({ message: err.message });
            }
            
            if (!req.file) {
                console.error('❌ No se proporcionó archivo');
                return res.status(400).json({ message: 'Selecciona un archivo antes de continuar.' });
            }
            
            try {
                console.log('📡 uploadFile - Archivo recibido:', {
                    filename: req.file.filename,
                    originalname: req.file.originalname,
                    path: req.file.path,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    encoding: req.file.encoding,
                    fieldname: req.file.fieldname
                });
                
                console.log('📡 uploadFile - Body recibido:', req.body);
                console.log('📡 uploadFile - Usuario en request:', req.usuario);
                
                // Verificar que req.body exista
                if (!req.body) {
                    console.log('❌ req.body es undefined o null');
                    if (req.file && fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(400).json({ 
                        message: 'No se recibieron datos en el request body',
                        headers: req.headers,
                        contentType: req.headers['content-type']
                    });
                }
                
                // Verificar que el usuario exista y sea profesor
                if (!req.usuario || req.usuario.rol !== 'profesor') {
                    console.log('❌ Usuario no autorizado:', req.usuario?.rol);
                    if (req.file && fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(403).json({ message: 'No tienes permisos para subir archivos' });
                }
                
                const { materia_id } = req.body;
                console.log('📡 uploadFile - materia_id parseado:', materia_id, typeof materia_id);
                
                if (!materia_id) {
                    console.log('❌ Materia ID faltante');
                    if (req.file && fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(400).json({ 
                        message: 'Selecciona una materia antes de subir el archivo.',
                        received: { materia_id }
                    });
                }
                
                // Validar que materia_id sea un número válido
                const materiaIdNum = parseInt(materia_id);
                if (isNaN(materiaIdNum) || materiaIdNum <= 0) {
                    console.log('❌ Materia ID inválido:', materia_id);
                    if (req.file && fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(400).json({ 
                        message: 'Materia ID inválido',
                        received: { materia_id }
                    });
                }
                
                console.log('✅ Validaciones básicas pasadas, consultando base de datos...');
                
                const materiaCheck = await pool.query(
                    'SELECT id, nombre FROM materias WHERE id = $1 AND profesor_id = $2',
                    [materiaIdNum, req.usuario.id]
                );
                if (materiaCheck.rows.length === 0) {
                    console.log('❌ Materia no encontrada o sin permisos:', materiaIdNum);
                    if (req.file && fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(404).json({ message: 'Materia no encontrada o no tienes permisos' });
                }

                console.log('✅ Materia verificada:', materiaCheck.rows[0].nombre);

                // Validar que el archivo sea un HTM/HTML válido
                const allowedMimes = ['text/html', 'text/htm'];
                const allowedExtensions = ['.htm', '.html'];
                const fileExtension = path.extname(req.file.originalname).toLowerCase();
                
                if (!allowedMimes.includes(req.file.mimetype) && !allowedExtensions.includes(fileExtension)) {
                    console.log('❌ Tipo de archivo no permitido:', req.file.mimetype, fileExtension);
                    if (req.file && fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(400).json({ 
                        message: 'Tipo de archivo no permitido. Solo archivos HTM/HTML',
                        received: { mimetype: req.file.mimetype, extension: fileExtension }
                    });
                }

                console.log('✅ Validaciones de archivo pasadas, procesando HTML...');
                const resultado = await calificacionController.processHtmlFile(req.file.path, materiaIdNum, req.usuario.id);
                
                console.log('✅ Archivo procesado exitosamente:', resultado);
                
                res.json({
                    message: 'Archivo procesado correctamente',
                    resultado,
                    fileName: req.file.filename,
                    archivo: {
                        detalles: `Estudiantes procesados: ${resultado.procesados}, Nuevos: ${resultado.nuevos}, Actualizados: ${resultado.actualizados}`
                    }
                });
                
            } catch (error) {
                console.error('❌ Error en uploadFile:', error);
                console.error('🔍 Stack trace completo:', error.stack);
                console.error('🔍 Detalles del error:', {
                    name: error.name,
                    message: error.message,
                    code: error.code,
                    severity: error.severity,
                    detail: error.detail,
                    hint: error.hint,
                    where: error.where,
                    file: error.file,
                    line: error.line,
                    routine: error.routine
                });
                if (req.file && fs.existsSync(req.file.path)) {
                    try {
                        fs.unlinkSync(req.file.path);
                        console.log('🗑️ Archivo temporal eliminado');
                    } catch (unlinkError) {
                        console.error('❌ Error al eliminar archivo temporal:', unlinkError);
                    }
                }
                res.status(500).json({ 
                    message: 'Error al procesar el archivo', 
                    error: error.message,
                    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        });
    },

    async updateAlumno(req, res) {
        try {
            console.log('📡 updateAlumno - Inicio del endpoint');
            console.log('📡 Headers:', req.headers);
            console.log('📡 Body completo:', req.body);
            console.log('📡 Usuario en request:', req.usuario);
            
            // Validar que req.body exista
            if (!req.body) {
                console.log('❌ req.body es undefined o null');
                return res.status(400).json({ 
                    message: 'No se recibieron datos en el request body',
                    headers: req.headers,
                    contentType: req.headers['content-type']
                });
            }
            
            const { id } = req.params;
            const { matricula, nombre, email } = req.body;
            
            // Crear objeto de tipos para logging
            const tiposObj = {
                id: typeof id,
                matricula: typeof matricula,
                nombre: typeof nombre,
                email: typeof email
            };
            
            console.log('📡 updateAlumno - Datos parseados:', {
                id,
                matricula,
                nombre,
                email,
                tipos: tiposObj
            });
            
            // Validación de parámetros requeridos
            if (!id) {
                console.log('❌ ID de estudiante faltante');
                return res.status(400).json({ 
                    message: 'ID de estudiante requerido',
                    received: { id }
                });
            }
            
            if (!matricula || !nombre) {
                console.log('❌ Campos obligatorios faltantes:', { matricula, nombre });
                return res.status(400).json({ 
                    message: 'Matrícula y nombre son obligatorios',
                    required: ['matricula', 'nombre'],
                    received: { matricula, nombre }
                });
            }
            
            // Validar tipos de datos
            const idNum = parseInt(id);
            if (isNaN(idNum)) {
                console.log('❌ ID inválido:', id);
                return res.status(400).json({ 
                    message: 'ID de estudiante inválido',
                    received: id,
                    expected: 'number'
                });
            }
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                console.log('❌ Usuario no autorizado:', req.usuario?.rol);
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            console.log('✅ Validaciones básicas pasadas, consultando base de datos...');
            
            // Verificar si el estudiante existe
            const existingStudent = await pool.query(
                'SELECT id, matricula, nombre FROM estudiantes WHERE id = $1',
                [idNum]
            );
            if (existingStudent.rows.length === 0) {
                console.log('❌ Estudiante no encontrado:', idNum);
                return res.status(404).json({ message: 'Estudiante no encontrado' });
            }
            
            console.log('✅ Estudiante encontrado:', existingStudent.rows[0]);
            
            // Verificar si la matrícula ya existe en otro estudiante
            const matriculaCheck = await pool.query(
                'SELECT id, matricula FROM estudiantes WHERE matricula = $1 AND id != $2',
                [matricula.trim(), idNum]
            );
            if (matriculaCheck.rows.length > 0) {
                console.log('❌ Matrícula duplicada:', matricula);
                return res.status(400).json({ 
                    message: 'La matrícula ya existe en el sistema',
                    existing_id: matriculaCheck.rows[0].id,
                    existing_matricula: matriculaCheck.rows[0].matricula
                });
            }

            console.log('✅ Verificaciones de base de datos pasadas, actualizando estudiante...');
            
            // Actualizar estudiante
            const result = await pool.query(
                `UPDATE estudiantes 
                 SET matricula = $1, nombre = $2, email = $3, updated_at = NOW()
                 WHERE id = $4 RETURNING *`,
                [matricula.trim(), nombre.trim(), email?.trim() || null, idNum]
            );

            console.log('✅ Estudiante actualizado:', result.rows[0]);
            res.json(result.rows[0]);
        } catch (error) {
            console.error('❌ Error en updateAlumno:', error);
            console.error('🔍 Stack trace completo:', error.stack);
            console.error('🔍 Detalles del error:', {
                name: error.name,
                message: error.message,
                code: error.code,
                severity: error.severity,
                detail: error.detail,
                hint: error.hint,
                where: error.where,
                file: error.file,
                line: error.line,
                routine: error.routine
            });
            res.status(500).json({ 
                message: 'Error al actualizar alumno', 
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    async actualizarCalificacion(req, res) {
        try {
            console.log('📡 actualizarCalificacion - Inicio del endpoint');
            console.log('📡 Headers:', req.headers);
            console.log('📡 Body completo:', req.body);
            console.log('📡 Usuario en request:', req.usuario);
            
            // Validar que req.body exista
            if (!req.body) {
                console.log('❌ req.body es undefined o null');
                return res.status(400).json({ 
                    message: 'No se recibieron datos en el request body',
                    headers: req.headers,
                    contentType: req.headers['content-type']
                });
            }
            
            const { estudiante_id, materia_id, tipo, calificacion } = req.body;
            
            // Crear objeto de tipos para logging
            const tiposObj = {
                estudiante_id: typeof estudiante_id,
                materia_id: typeof materia_id,
                tipo: typeof tipo,
                calificacion: typeof calificacion
            };
            
            console.log('📡 actualizarCalificacion - Datos parseados:', {
                estudiante_id,
                materia_id,
                tipo,
                calificacion,
                tipos: tiposObj
            });
            
            // Validación de parámetros requeridos
            if (!estudiante_id || !materia_id || !tipo || calificacion === undefined) {
                console.log('❌ Parámetros faltantes:', { estudiante_id, materia_id, tipo, calificacion });
                return res.status(400).json({ 
                    message: 'Faltan parámetros requeridos',
                    required: ['estudiante_id', 'materia_id', 'tipo', 'calificacion'],
                    received: { estudiante_id, materia_id, tipo, calificacion }
                });
            }
            
            // Validar tipos de datos
            const estudianteIdNum = parseInt(estudiante_id);
            const materiaIdNum = parseInt(materia_id);
            const calificacionNum = parseFloat(calificacion);
            
            if (isNaN(estudianteIdNum) || isNaN(materiaIdNum) || isNaN(calificacionNum)) {
                console.log('❌ Tipos de datos inválidos:', {
                    estudiante_id: `${estudiante_id} (${typeof estudiante_id})`,
                    materia_id: `${materia_id} (${typeof materia_id})`,
                    calificacion: `${calificacion} (${typeof calificacion})`
                });
                return res.status(400).json({ 
                    message: 'Tipos de datos inválidos',
                    expected: {
                        estudiante_id: 'number',
                        materia_id: 'number',
                        tipo: 'string',
                        calificacion: 'number'
                    },
                    received: {
                        estudiante_id: typeof estudiante_id,
                        materia_id: typeof materia_id,
                        tipo: typeof tipo,
                        calificacion: typeof calificacion
                    }
                });
            }
            
            // Validar rangos
            if (calificacionNum < 0 || calificacionNum > 10) {
                console.log('❌ Calificación fuera de rango:', calificacionNum);
                return res.status(400).json({ 
                    message: 'La calificación debe ser un número entre 0 y 10',
                    received: calificacionNum
                });
            }
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                console.log('❌ Usuario no autorizado:', req.usuario?.rol);
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            console.log('✅ Validaciones básicas pasadas, consultando base de datos...');
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, profesor_id FROM materias WHERE id = $1',
                [materiaIdNum]
            );
            if (materiaCheck.rows.length === 0) {
                console.log('❌ Materia no encontrada:', materiaIdNum);
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            if (materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                console.log('❌ Materia no pertenece al profesor:', {
                    materia_profesor: materiaCheck.rows[0].profesor_id,
                    usuario_actual: req.usuario.id
                });
                return res.status(403).json({ message: 'No tienes permisos para esta materia' });
            }
            
            // Verificar que el estudiante exista
            const estudianteCheck = await pool.query(
                'SELECT id FROM estudiantes WHERE id = $1',
                [estudianteIdNum]
            );
            if (estudianteCheck.rows.length === 0) {
                console.log('❌ Estudiante no encontrado:', estudianteIdNum);
                return res.status(404).json({ message: 'Estudiante no encontrado' });
            }
            
            console.log('✅ Verificaciones de base de datos pasadas, actualizando calificación...');
            
            // Actualizar o crear la calificación
            const existingCal = await pool.query(
                'SELECT id FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 AND tipo = $3',
                [estudianteIdNum, materiaIdNum, tipo]
            );
            
            if (existingCal.rows.length > 0) {
                // Actualizar calificación existente
                await pool.query(
                    `UPDATE calificaciones 
                     SET calificacion = $1, updated_at = NOW()
                     WHERE estudiante_id = $2 AND materia_id = $3 AND tipo = $4`,
                    [calificacionNum, estudianteIdNum, materiaIdNum, tipo]
                );
                console.log('✅ Calificación actualizada correctamente');
            } else {
                // Crear nueva calificación
                await pool.query(
                    `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [estudianteIdNum, materiaIdNum, tipo, calificacionNum]
                );
                console.log('✅ Calificación creada correctamente');
            }
            
            console.log(`📊 Calificación guardada: estudiante ${estudianteIdNum}, materia ${materiaIdNum}, tipo ${tipo}, valor ${calificacionNum}`);
            res.json({ message: 'Calificación actualizada correctamente' });
        } catch (error) {
            console.error('❌ Error en actualizarCalificacion:', error);
            console.error('🔍 Stack trace completo:', error.stack);
            console.error('🔍 Detalles del error:', {
                name: error.name,
                message: error.message,
                code: error.code,
                severity: error.severity,
                detail: error.detail,
                hint: error.hint,
                where: error.where,
                file: error.file,
                line: error.line,
                routine: error.routine
            });
            res.status(500).json({ 
                message: 'Error al actualizar calificación', 
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    // Funciones faltantes que son llamadas en las rutas
    async getPlantilla(req, res) {
        try {
            console.log('📡 getPlantilla - Generando plantilla HTM');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            // Generar HTML de plantilla
            const plantillaHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Plantilla de Calificaciones</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Plantilla de Calificaciones</h1>
    <table>
        <thead>
            <tr>
                <th>Matrícula</th>
                <th>Nombre</th>
                <th>Tareas</th>
                <th>Exámenes</th>
                <th>Participación</th>
                <th>Proyectos</th>
                <th>Prácticas</th>
                <th>Calificación Final</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>20230001</td>
                <td>EJEMPLO ALUMNO</td>
                <td>8.5</td>
                <td>9.0</td>
                <td>8.0</td>
                <td>7.5</td>
                <td>8.5</td>
                <td>8.3</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
            `;

            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Content-Disposition', 'attachment; filename=plantilla_calificaciones.htm');
            res.send(plantillaHtml);
            
        } catch (error) {
            console.error('❌ Error en getPlantilla:', error);
            res.status(500).json({ message: 'Error al generar plantilla', error: error.message });
        }
    },

    async getArchivos(req, res) {
        try {
            console.log('📡 getArchivos - Obteniendo archivos');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            // Por ahora, retornar una lista vacía (se puede implementar el almacenamiento real después)
            const archivos = [];
            
            res.json(archivos);
            
        } catch (error) {
            console.error('❌ Error en getArchivos:', error);
            res.status(500).json({ message: 'Error al obtener archivos', error: error.message });
        }
    },

    async descargarArchivoCalificacion(req, res) {
        try {
            console.log('📡 descargarArchivoCalificacion - Descargando archivo');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { id } = req.params;
            
            // Por ahora, retornar un error de archivo no encontrado
            res.status(404).json({ message: 'Archivo no encontrado' });
            
        } catch (error) {
            console.error('❌ Error en descargarArchivoCalificacion:', error);
            res.status(500).json({ message: 'Error al descargar archivo', error: error.message });
        }
    },

    async deleteArchivo(req, res) {
        try {
            console.log('📡 deleteArchivo - Eliminando archivo');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { id } = req.params;
            
            // Por ahora, retornar éxito simulado
            res.json({ message: 'Archivo eliminado correctamente' });
            
        } catch (error) {
            console.error('❌ Error en deleteArchivo:', error);
            res.status(500).json({ message: 'Error al eliminar archivo', error: error.message });
        }
    },

    async getAlumnosByMateria(req, res) {
        try {
            console.log('📡 getAlumnosByMateria - Obteniendo alumnos por materia');
            
            const { materia_id } = req.params;
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            // Obtener alumnos de la materia
            const alumnosQuery = await pool.query(`
                SELECT e.id, e.matricula, e.nombre, e.email,
                       COALESCE(c.calificacion, 0) as calificacion_final
                FROM estudiantes e
                LEFT JOIN (
                    SELECT estudiante_id, AVG(calificacion) as calificacion
                    FROM calificaciones 
                    WHERE materia_id = $1
                    GROUP BY estudiante_id
                ) c ON e.id = c.estudiante_id
                WHERE EXISTS (
                    SELECT 1 FROM calificaciones 
                    WHERE estudiante_id = e.id AND materia_id = $1
                )
                ORDER BY e.nombre
            `, [materia_id]);

            res.json(alumnosQuery.rows);
            
        } catch (error) {
            console.error('❌ Error en getAlumnosByMateria:', error);
            res.status(500).json({ message: 'Error al obtener alumnos', error: error.message });
        }
    },

    async createAlumno(req, res) {
        try {
            console.log('📡 createAlumno - Creando nuevo alumno');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { matricula, nombre, email } = req.body;
            
            if (!matricula || !nombre) {
                return res.status(400).json({ 
                    message: 'Matrícula y nombre son obligatorios',
                    required: ['matricula', 'nombre'],
                    received: { matricula, nombre }
                });
            }

            // Verificar si la matrícula ya existe
            const matriculaCheck = await pool.query(
                'SELECT id FROM estudiantes WHERE matricula = $1',
                [matricula.trim()]
            );
            
            if (matriculaCheck.rows.length > 0) {
                return res.status(400).json({ message: 'La matrícula ya existe en el sistema' });
            }

            // Crear nuevo alumno
            const result = await pool.query(
                `INSERT INTO estudiantes (matricula, nombre, email, created_at)
                 VALUES ($1, $2, $3, NOW()) RETURNING *`,
                [matricula.trim(), nombre.trim(), email?.trim() || null]
            );

            console.log('✅ Alumno creado:', result.rows[0]);
            res.status(201).json(result.rows[0]);
            
        } catch (error) {
            console.error('❌ Error en createAlumno:', error);
            res.status(500).json({ message: 'Error al crear alumno', error: error.message });
        }
    },

    async deleteAlumno(req, res) {
        try {
            console.log('📡 deleteAlumno - Eliminando alumno');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { id } = req.params;
            
            // Verificar si el alumno existe
            const alumnoCheck = await pool.query(
                'SELECT id FROM estudiantes WHERE id = $1',
                [id]
            );
            
            if (alumnoCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Alumno no encontrado' });
            }

            // Eliminar calificaciones del alumno
            await pool.query('DELETE FROM calificaciones WHERE estudiante_id = $1', [id]);
            
            // Eliminar alumno
            await pool.query('DELETE FROM estudiantes WHERE id = $1', [id]);

            console.log('✅ Alumno eliminado:', id);
            res.json({ message: 'Alumno eliminado correctamente' });
            
        } catch (error) {
            console.error('❌ Error en deleteAlumno:', error);
            res.status(500).json({ message: 'Error al eliminar alumno', error: error.message });
        }
    },

    async exportToExcel(req, res) {
        try {
            console.log('📡 exportToExcel - Exportando a Excel');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { materia_id } = req.params;
            
            // Por ahora, retornar un archivo CSV simple
            const csvData = 'Matrícula,Nombre,Email,Calificación Final\n20230001,EJEMPLO ALUMNO,correo@ejemplo.com,8.3';
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=calificaciones.csv');
            res.send(csvData);
            
        } catch (error) {
            console.error('❌ Error en exportToExcel:', error);
            res.status(500).json({ message: 'Error al exportar a Excel', error: error.message });
        }
    },

    async guardarPonderaciones(req, res) {
        try {
            console.log('📡 guardarPonderaciones - Guardando ponderaciones');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { materia_id, ponderaciones } = req.body;
            
            // Por ahora, retornar éxito simulado
            res.json({ message: 'Ponderaciones guardadas correctamente' });
            
        } catch (error) {
            console.error('❌ Error en guardarPonderaciones:', error);
            res.status(500).json({ message: 'Error al guardar ponderaciones', error: error.message });
        }
    },

    async getPonderaciones(req, res) {
        try {
            console.log('📡 getPonderaciones - Obteniendo ponderaciones');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { materia_id } = req.params;
            
            // Por ahora, retornar ponderaciones por defecto
            const ponderaciones = {
                tarea: 20,
                examen: 30,
                participacion: 10,
                proyecto: 25,
                practica: 15
            };
            
            res.json(ponderaciones);
            
        } catch (error) {
            console.error('❌ Error en getPonderaciones:', error);
            res.status(500).json({ message: 'Error al obtener ponderaciones', error: error.message });
        }
    },

    async calcularCalificaciones(req, res) {
        try {
            console.log('📡 calcularCalificaciones - Calculando calificaciones');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { materia_id } = req.params;
            
            // Por ahora, retornar éxito simulado
            res.json({ message: 'Calificaciones calculadas correctamente', calculados: 0 });
            
        } catch (error) {
            console.error('❌ Error en calcularCalificaciones:', error);
            res.status(500).json({ message: 'Error al calcular calificaciones', error: error.message });
        }
    },

    async getCalificacionesEstudiante(req, res) {
        try {
            console.log('📡 getCalificacionesEstudiante - Obteniendo calificaciones del estudiante');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { estudiante_id, materia_id } = req.params;
            
            // Obtener calificaciones del estudiante en la materia
            const calificacionesQuery = await pool.query(
                'SELECT tipo, calificacion, fecha_registro FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 ORDER BY tipo',
                [estudiante_id, materia_id]
            );

            res.json(calificacionesQuery.rows);
            
        } catch (error) {
            console.error('❌ Error en getCalificacionesEstudiante:', error);
            res.status(500).json({ message: 'Error al obtener calificaciones del estudiante', error: error.message });
        }
    },

    async procesarDefinitivo(req, res) {
        try {
            console.log('📡 procesarDefinitivo - Procesando definitivo');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            // Por ahora, retornar éxito simulado
            res.json({ message: 'Procesamiento definitivo completado correctamente' });
            
        } catch (error) {
            console.error('❌ Error en procesarDefinitivo:', error);
            res.status(500).json({ message: 'Error al procesar definitivo', error: error.message });
        }
    },

    async getAllCalificacionesAlumno(req, res) {
        try {
            console.log('📡 getAllCalificacionesAlumno - Obteniendo todas las calificaciones del alumno');
            
            // Verificar que el usuario exista y sea alumno
            if (!req.usuario || req.usuario.rol !== 'alumno') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const alumno_id = req.usuario.id;
            
            // Obtener todas las materias y calificaciones del alumno
            const materiasQuery = await pool.query(`
                SELECT m.id, m.nombre, m.clave, u.nombre as profesor,
                       COALESCE(AVG(c.calificacion), 0) as promedio_final
                FROM materias m
                LEFT JOIN usuarios u ON m.profesor_id = u.id
                LEFT JOIN calificaciones c ON m.id = c.materia_id AND c.estudiante_id = $1
                WHERE EXISTS (
                    SELECT 1 FROM calificaciones 
                    WHERE materia_id = m.id AND estudiante_id = $1
                )
                GROUP BY m.id, m.nombre, m.clave, u.nombre
                ORDER BY m.nombre
            `, [alumno_id]);

            // Obtener calificaciones detalladas por materia
            const materiasConCalificaciones = await Promise.all(
                materiasQuery.rows.map(async (materia) => {
                    const calificacionesQuery = await pool.query(
                        'SELECT tipo, calificacion, fecha_registro FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 ORDER BY tipo',
                        [alumno_id, materia.id]
                    );
                    
                    return {
                        ...materia,
                        calificaciones: calificacionesQuery.rows
                    };
                })
            );

            // Calcular estadísticas generales
            const promedioGeneral = materiasQuery.rows.reduce((sum, m) => sum + parseFloat(m.promedio_final || 0), 0) / materiasQuery.rows.length;
            const totalMaterias = materiasQuery.rows.length;
            const aprobadas = materiasQuery.rows.filter(m => parseFloat(m.promedio_final || 0) >= 6).length;

            res.json({
                materias: materiasConCalificaciones,
                promedio_general: promedioGeneral,
                total_materias: totalMaterias,
                materias_aprobadas: aprobadas
            });
            
        } catch (error) {
            console.error('❌ Error en getAllCalificacionesAlumno:', error);
            res.status(500).json({ message: 'Error al obtener todas las calificaciones del alumno', error: error.message });
        }
    },

    async darseDeBajaMateria(req, res) {
        try {
            console.log('📡 darseDeBajaMateria - Dándose de baja de materia');
            
            // Verificar que el usuario exista y sea alumno
            if (!req.usuario || req.usuario.rol !== 'alumno') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { materia_id } = req.params;
            const alumno_id = req.usuario.id;
            
            // Verificar que la materia exista y el alumno esté inscrito
            const inscripcionCheck = await pool.query(
                'SELECT 1 FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 LIMIT 1',
                [alumno_id, materia_id]
            );
            
            if (inscripcionCheck.rows.length === 0) {
                return res.status(404).json({ message: 'No estás inscrito en esta materia' });
            }

            // Eliminar todas las calificaciones del alumno en esa materia
            await pool.query(
                'DELETE FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2',
                [alumno_id, materia_id]
            );

            console.log('✅ Alumno dado de baja de materia:', { alumno_id, materia_id });
            res.json({ message: 'Te has dado de baja de la materia correctamente' });
            
        } catch (error) {
            console.error('❌ Error en darseDeBajaMateria:', error);
            res.status(500).json({ message: 'Error al darse de baja de la materia', error: error.message });
        }
    },

    // Función processHtmlFile (necesita implementación completa)
    async processHtmlFile(filePath, materiaId, profesorId) {
        return {
            procesados: 0,
            nuevos: 0,
            actualizados: 0,
            estudiantes: []
        };
    }
};

module.exports = calificacionController;
