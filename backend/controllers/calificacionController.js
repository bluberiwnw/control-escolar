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

    // Función placeholder para processHtmlFile (necesita implementación completa)
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
