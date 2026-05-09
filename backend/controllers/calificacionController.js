const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
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
                console.error('❌ req.file:', req.file);
                console.error('❌ req.body:', req.body);
                console.error('❌ req.usuario:', req.usuario);
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
                console.log('📡 uploadFile - Body tipo:', typeof req.body);
                console.log('📡 uploadFile - Body keys:', Object.keys(req.body || {}));
                console.log('📡 uploadFile - Usuario en request:', req.usuario);
                
                // Verificar que req.body exista y limpiar datos
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
                
                // Limpiar materia_id de caracteres especiales
                if (req.body.materia_id) {
                    req.body.materia_id = req.body.materia_id.trim();
                }
                
                // Verificar que el usuario exista y tenga permisos
                if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
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
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
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

            console.log('✅ Verificaciones de base de datos pasadas, actualizando estudiante...');
            
            // Actualizar estudiante
            const result = await pool.query(
                `UPDATE estudiantes 
                 SET matricula = $1, nombre = $2, email = $3
                 WHERE id = $4 RETURNING id, matricula, nombre, email`,
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

            // Leer plantilla BUAP real
            const fs = require('fs');
            const path = require('path');
            const plantillaPath = path.join(__dirname, '../templates/plantilla_buap_completa.htm');
            
            let plantillaHtml;
            if (fs.existsSync(plantillaPath)) {
                plantillaHtml = fs.readFileSync(plantillaPath, 'utf8');
                console.log('✅ Plantilla BUAP cargada desde archivo');
            } else {
                // Generar plantilla BUAP básica si no existe el archivo
                plantillaHtml = `
<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html lang="en" translate="no" class="notranslate">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Resumen de lista de clase</title>
</head>
<body>
<div class="pagebodydiv">
<table class="datadisplaytable" summary="Esta tabla despliega los atributos de curso.">
<caption class="captiontext">Información de Curso</caption>
<tbody><tr>
<th colspan="2" class="ddlabel" scope="row">[NOMBRE_MATERIA] - [CLAVE_MATERIA]</th>
</tr>
<tr>
<th class="ddlabel" scope="row">NRC:</th>
<td class="dddefault">[NRC]</td>
</tr>
<tr>
<th class="ddlabel" scope="row">Duración:</th>
<td class="dddefault">[FECHA_INICIO] - [FECHA_FIN]</td>
</tr>
<tr>
<th class="ddlabel" scope="row">Status:</th>
<td class="dddefault">Activo</td>
</tr>
</tbody></table>
<br>
<table class="datadisplaytable" summary="Esta tabla despliega los conteos de ingreso y de lista de espera.">
<caption class="captiontext">Conteo de Ingreso</caption>
<tbody><tr>
<th class="ddheader" scope="col">&nbsp;</th>
<th class="ddheader" scope="col">Máximo</th>
<th class="ddheader" scope="col">Real</th>
<th class="ddheader" scope="col">Restante</th>
</tr>
<tr>
<th class="ddlabel" scope="row">Ingreso:</th>
<td class="dddefault">30</td>
<td class="dddefault">0</td>
<td class="dddefault">30</td>
</tr>
</tbody></table>
<br>
<table class="datadisplaytable" summary="Esta tabla despliega una lista de alumnos inscritos para el curso, se provee información de resumen para cada alumno." width="100%">
<caption class="captiontext">Resumen de Lista de Clase</caption>
<tbody><tr>
<th class="ddheader" scope="col">Número de<br>Registro</th>
<th class="ddheader" scope="col">Nombre de Alumno</th>
<th class="ddheader" scope="col">ID</th>
<th class="ddheader" scope="col">Status de Inscripción</th>
<th class="ddheader" scope="col">Nivel</th>
<th class="ddheader" scope="col">Créditos</th>
<th class="ddheader" scope="col">Detalle de Calificaciones</th>
<td class="dddead">&nbsp;</td>
</tr>
<tr>
<td class="dddefault">1</td>
<td class="dddefault"><span class="fieldmediumtext">APELLIDO PATERNO, APELLIDO MATERNO NOMBRE(S) </span></td>
<td class="dddefault"><span class="fieldmediumtext">202300001</span></td>
<td class="dddefault"><span class="fieldmediumtext">**Inscrito por Web**</span></td>
<td class="dddefault"><span class="fieldmediumtext">Licenciatura</span></td>
<td class="dddefault"><span class="fieldmediumtext">    6.000</span></td>
<td class="dddead">&nbsp;</td>
<td class="dddefault"><span class="fieldmediumtext"><a href="mailto:alumno@alumno.buap.mx" target="NOMBRE COMPLETO"><img src="email.gif" align="middle" alt="Correo-e" border="0" height="28" width="28"></a></span></td>
</tr>
</tbody></table>
</div>
</body>
</html>
                `;
                console.log('⚠️ Plantilla BUAP generada por defecto');
            }

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

            // Obtener alumnos de la materia con todas sus calificaciones
            const alumnosQuery = await pool.query(`
                SELECT DISTINCT e.id, e.matricula, e.nombre, e.email
                FROM estudiantes e
                WHERE EXISTS (
                    SELECT 1 FROM calificaciones 
                    WHERE estudiante_id = e.id AND materia_id = $1
                )
                ORDER BY e.nombre
            `, [materia_id]);
            
            // Obtener calificaciones para cada alumno
            const alumnosConCalificaciones = await Promise.all(
                alumnosQuery.rows.map(async (alumno) => {
                    const calificacionesQuery = await pool.query(`
                        SELECT tipo, calificacion, fecha_registro
                        FROM calificaciones 
                        WHERE estudiante_id = $1 AND materia_id = $2
                        ORDER BY tipo
                    `, [alumno.id, materia_id]);
                    
                    // Calcular promedio final
                    const calificaciones = calificacionesQuery.rows;
                    const promedioFinal = calificaciones.length > 0 
                        ? calificaciones.reduce((sum, c) => sum + parseFloat(c.calificacion), 0) / calificaciones.length
                        : 0;
                    
                    // Construir objeto con todas las calificaciones
                    const calificacionesObj = {};
                    calificaciones.forEach(c => {
                        calificacionesObj[c.tipo] = parseFloat(c.calificacion);
                    });
                    
                    return {
                        ...alumno,
                        ...calificacionesObj,
                        calificacion_final: promedioFinal,
                        calificaciones_detalle: calificaciones
                    };
                })
            );

            res.json(alumnosConCalificaciones);
            
        } catch (error) {
            console.error('❌ Error en getAlumnosByMateria:', error);
            res.status(500).json({ message: 'Error al obtener alumnos', error: error.message });
        }
    },

    async createAlumno(req, res) {
        try {
            console.log('📡 createAlumno - Creando nuevo alumno');
            console.log('📡 createAlumno - Body recibido:', req.body);
            console.log('📡 createAlumno - Body tipo:', typeof req.body);
            console.log('📡 createAlumno - Body keys:', Object.keys(req.body || {}));
            console.log('📡 createAlumno - Usuario en request:', req.usuario);
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                console.log('❌ createAlumno - Usuario no autorizado:', req.usuario?.rol);
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            if (!req.body) {
                console.log('❌ createAlumno - req.body es undefined o null');
                return res.status(400).json({ 
                    message: 'No se recibieron datos en el request body',
                    received: req.body,
                    contentType: req.headers['content-type']
                });
            }

            const { matricula, nombre, email, materia_id } = req.body;
            console.log('📡 createAlumno - Datos extraídos:', { matricula, nombre, email, materia_id });
            
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
                `INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, matricula, nombre, email, created_at`,
                [matricula.trim(), nombre.trim(), email?.trim() || null, 'temporal123', 'alumno', true]
            );

            const nuevoAlumno = result.rows[0];
            console.log('✅ Alumno creado:', nuevoAlumno);

            // Si se proporcionó materia_id, asociar el alumno a la materia
            if (materia_id) {
                console.log('📡 Asociando alumno a materia:', materia_id);
                await pool.query(
                    'INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion) VALUES ($1, $2, NOW())',
                    [materia_id, nuevoAlumno.id]
                );
            }

            res.status(201).json(nuevoAlumno);
            
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

            const { materia_id, timestamp } = req.body;
            
            if (!materia_id) {
                return res.status(400).json({ message: 'ID de materia requerido' });
            }
            
            // Validar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada o sin permisos' });
            }
            
            // Marcar la materia como definitiva (bloquear ediciones)
            await pool.query(`
                UPDATE materias 
                SET definitiva = true, definitiva_fecha = NOW(), definitiva_usuario_id = $1
                WHERE id = $2
            `, [req.usuario.id, materia_id]);
            
            // Opcional: Notificar a administradores
            const adminUsers = await pool.query(
                'SELECT id, email FROM usuarios WHERE rol = $1 AND activo = true',
                ['administrador']
            );
            
            for (const admin of adminUsers.rows) {
                await pool.query(`
                    INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                `, [
                    admin.id,
                    'calificaciones_definitivas',
                    `Calificaciones Definitivas - ${materiaCheck.rows[0].nombre}`,
                    `El profesor ${req.usuario.nombre} ha enviado las calificaciones definitivamente para la materia ${materiaCheck.rows[0].nombre}.`
                ]);
            }
            
            console.log('✅ Procesamiento definitivo completado para materia:', materia_id);
            res.json({ 
                message: 'Calificaciones enviadas definitivamente. Las ediciones han sido bloqueadas.',
                materia_id,
                materia_nombre: materiaCheck.rows[0].nombre,
                timestamp: new Date().toISOString()
            });
            
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
                    
                    // Calcular calificación final con la misma fórmula que usa el profesor
                    const calificaciones = calificacionesQuery.rows;
                    let tareas = 0, examenes = 0, participacion = 0, proyectos = 0, practicas = 0;
                    
                    calificaciones.forEach(cal => {
                        switch(cal.tipo) {
                            case 'tarea': tareas = parseFloat(cal.calificacion); break;
                            case 'examen': examenes = parseFloat(cal.calificacion); break;
                            case 'participacion': participacion = parseFloat(cal.calificacion); break;
                            case 'proyecto': proyectos = parseFloat(cal.calificacion); break;
                            case 'practica': practicas = parseFloat(cal.calificacion); break;
                        }
                    });
                    
                    const calificacionFinal = (
                        proyectos * 0.30 +
                        examenes * 0.30 +
                        participacion * 0.10 +
                        tareas * 0.20 +
                        practicas * 0.10
                    );
                    
                    const calificacionFinalAjustada = Math.max(0, Math.min(10, calificacionFinal));
                    
                    return {
                        ...materia,
                        calificaciones: calificacionesQuery.rows,
                        tareas,
                        examenes,
                        participacion,
                        proyectos,
                        practicas,
                        calificacion_final: calificacionFinalAjustada
                    };
                })
            );

            // Calcular estadísticas generales usando los datos procesados
            const materiasConCalificacionesValidas = materiasConCalificaciones.filter(m => 
                m.calificacion_final !== null && m.calificacion_final !== undefined && m.calificacion_final > 0
            );
            
            const promedioGeneral = materiasConCalificacionesValidas.length > 0 
                ? materiasConCalificacionesValidas.reduce((sum, m) => sum + parseFloat(m.calificacion_final || 0), 0) / materiasConCalificacionesValidas.length
                : 0;
            const totalMaterias = materiasConCalificaciones.length;
            const aprobadas = materiasConCalificacionesValidas.filter(m => parseFloat(m.calificacion_final || 0) >= 6).length;

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

    // Función para procesar archivos HTML con Cheerio
    async processHtmlFile(filePath, materiaId, profesorId) {
        try {
            console.log('📄 Procesando archivo HTML:', filePath);
            
            // Leer el archivo HTML
            const htmlContent = fs.readFileSync(filePath, 'utf8');
            const $ = cheerio.load(htmlContent);
            
            let procesados = 0;
            let nuevos = 0;
            let actualizados = 0;
            const estudiantes = [];
            
            // Buscar tablas en el HTML
            $('table').each((tableIndex, table) => {
                console.log(`📊 Procesando tabla ${tableIndex + 1}`);
                
                // Extraer encabezados primero
                const headers = [];
                $(table).find('tr:first-child th, tr:first-child td').each((index, header) => {
                    headers.push($(header).text().trim().toLowerCase());
                });
                
                console.log('📋 Encabezados encontrados:', headers);
                
                // Mapeo de columnas basado en encabezados
                const columnMapping = {};
                headers.forEach((header, index) => {
                    if (header.includes('matrícula') || header.includes('matricula')) {
                        columnMapping.matricula = index;
                    } else if (header.includes('nombre') || header.includes('name')) {
                        columnMapping.nombre = index;
                    } else if (header.includes('email') || header.includes('correo')) {
                        columnMapping.email = index;
                    } else if (header.includes('tarea') || header.includes('task')) {
                        columnMapping.tareas = index;
                    } else if (header.includes('examen') || header.includes('exam')) {
                        columnMapping.examenes = index;
                    } else if (header.includes('participación') || header.includes('participacion')) {
                        columnMapping.participacion = index;
                    } else if (header.includes('proyecto') || header.includes('project')) {
                        columnMapping.proyectos = index;
                    } else if (header.includes('práctica') || header.includes('practica') || header.includes('practice')) {
                        columnMapping.practicas = index;
                    } else if (header.includes('final') || header.includes('calificación') || header.includes('calificacion')) {
                        columnMapping.final = index;
                    }
                });
                
                console.log('🗺️ Mapeo de columnas:', columnMapping);
                
                // Procesar filas de datos (saltar encabezados)
                $(table).find('tr').each((rowIndex, row) => {
                    // Saltar la primera fila (encabezados)
                    if (rowIndex === 0) return;
                    
                    const cells = $(row).find('td, th');
                    if (cells.length < 2) return; // Mínimo 2 columnas
                    
                    // Extraer datos de las celdas
                    const rowData = [];
                    cells.each((cellIndex, cell) => {
                        rowData.push($(cell).text().trim());
                    });
                    
                    // Extraer datos usando el mapeo
                    let matricula = '';
                    let nombre = '';
                    let email = '';
                    let tareas = 0;
                    let examenes = 0;
                    let participacion = 0;
                    let proyectos = 0;
                    let practicas = 0;
                    let calificacionFinal = 0;
                    
                    // Extraer datos según el mapeo
                    if (columnMapping.matricula !== undefined) {
                        matricula = rowData[columnMapping.matricula] || '';
                    }
                    if (columnMapping.nombre !== undefined) {
                        nombre = rowData[columnMapping.nombre] || '';
                    }
                    if (columnMapping.email !== undefined) {
                        email = rowData[columnMapping.email] || '';
                    }
                    if (columnMapping.tareas !== undefined) {
                        tareas = parseFloat(rowData[columnMapping.tareas]) || 0;
                    }
                    if (columnMapping.examenes !== undefined) {
                        examenes = parseFloat(rowData[columnMapping.examenes]) || 0;
                    }
                    if (columnMapping.participacion !== undefined) {
                        participacion = parseFloat(rowData[columnMapping.participacion]) || 0;
                    }
                    if (columnMapping.proyectos !== undefined) {
                        proyectos = parseFloat(rowData[columnMapping.proyectos]) || 0;
                    }
                    if (columnMapping.practicas !== undefined) {
                        practicas = parseFloat(rowData[columnMapping.practicas]) || 0;
                    }
                    if (columnMapping.final !== undefined) {
                        calificacionFinal = parseFloat(rowData[columnMapping.final]) || 0;
                    }
                    
                    // Si no hay mapeo, intentar heurística automática
                    if (Object.keys(columnMapping).length === 0) {
                        console.log('🔍 Usando heurística automática para la fila:', rowData);
                        
                        // Detectar automáticamente
                        for (let i = 0; i < rowData.length; i++) {
                            const value = rowData[i];
                            
                            // Matrícula (solo números)
                            if (/^\d+$/.test(value) && !matricula) {
                                matricula = value;
                            }
                            // Email (contiene @)
                            else if (value.includes('@') && !email) {
                                email = value;
                            }
                            // Nombre (texto sin números ni @)
                            else if (!/^\d+$/.test(value) && !value.includes('@') && !nombre && value.length > 2) {
                                nombre = value;
                            }
                            // Calificaciones (números entre 0 y 10)
                            else {
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
                                    // Asignar en orden si no hay mapeo específico
                                    if (!tareas) tareas = numValue;
                                    else if (!examenes) examenes = numValue;
                                    else if (!participacion) participacion = numValue;
                                    else if (!proyectos) proyectos = numValue;
                                    else if (!practicas) practicas = numValue;
                                }
                            }
                        }
                    }
                    
                    // Calcular calificación final si no viene en el archivo
                    if (calificacionFinal === 0) {
                        calificacionFinal = calificacionController.calcularFinal({
                            tareas,
                            examenes,
                            participacion,
                            proyectos,
                            practicas
                        });
                    }
                    
                    // Validar datos mínimos
                    if (matricula || nombre) {
                        estudiantes.push({
                            matricula: matricula || 'AUTO_' + Date.now() + '_' + rowIndex,
                            nombre: nombre || 'Sin nombre',
                            email: email || '',
                            tareas,
                            examenes,
                            participacion,
                            proyectos,
                            practicas,
                            calificacion_final: calificacionFinal
                        });
                        
                        procesados++;
                        console.log(`✅ Estudiante procesado: ${nombre} (${matricula})`);
                    }
                });
            });
            
            console.log(`✅ Archivo HTML procesado: ${procesados} estudiantes encontrados`);
            
            // Guardar en base de datos
            for (const estudiante of estudiantes) {
                try {
                    // Buscar si el estudiante ya existe
                    const existingEstudiante = await pool.query(
                        'SELECT id FROM estudiantes WHERE matricula = $1',
                        [estudiante.matricula]
                    );
                    
                    let estudianteId;
                    if (existingEstudiante.rows.length > 0) {
                        estudianteId = existingEstudiante.rows[0].id;
                        actualizados++;
                    } else {
                        // Crear nuevo estudiante
                        const newEstudiante = await pool.query(
                            `INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
                            [estudiante.matricula, estudiante.nombre, estudiante.email, 'temporal123', 'alumno', true]
                        );
                        estudianteId = newEstudiante.rows[0].id;
                        nuevos++;
                        
                        // Asociar estudiante a la materia
                        await pool.query(
                            'INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion) VALUES ($1, $2, NOW())',
                            [materiaId, estudianteId]
                        );
                    }
                    
                    // Guardar calificaciones
                    const calificaciones = [
                        { tipo: 'tarea', calificacion: estudiante.tareas },
                        { tipo: 'examen', calificacion: estudiante.examenes },
                        { tipo: 'participacion', calificacion: estudiante.participacion },
                        { tipo: 'proyecto', calificacion: estudiante.proyectos },
                        { tipo: 'practica', calificacion: estudiante.practicas }
                    ];
                    
                    for (const cal of calificaciones) {
                        if (cal.calificacion > 0) {
                            await pool.query(`
                                INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                                VALUES ($1, $2, $3, $4, NOW())
                                ON CONFLICT (estudiante_id, materia_id, tipo) 
                                DO UPDATE SET calificacion = EXCLUDED.calificacion, updated_at = NOW()
                            `, [estudianteId, materiaId, cal.tipo, cal.calificacion]);
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ Error procesando estudiante ${estudiante.matricula}:`, error.message);
                }
            }
            
            return {
                procesados,
                nuevos,
                actualizados,
                estudiantes
            };
            
        } catch (error) {
            console.error('❌ Error al procesar archivo HTML:', error);
            throw error;
        }
    },
    
    // Función para guardar calificaciones de un alumno
    async guardarCalificacionesAlumno(req, res) {
        try {
            console.log('📡 guardarCalificacionesAlumno - Guardando calificaciones de alumno');
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { estudiante_id, materia_id, tareas, examenes, participacion, proyectos, practicas } = req.body;
            
            // Validación de parámetros requeridos
            if (!estudiante_id || !materia_id) {
                return res.status(400).json({ 
                    message: 'ID de estudiante y materia son obligatorios',
                    required: ['estudiante_id', 'materia_id'],
                    received: { estudiante_id, materia_id }
                });
            }
            
            // Validar tipos de datos
            const estudianteIdNum = parseInt(estudiante_id);
            const materiaIdNum = parseInt(materia_id);
            
            if (isNaN(estudianteIdNum) || isNaN(materiaIdNum)) {
                return res.status(400).json({ 
                    message: 'IDs inválidos',
                    received: { estudiante_id, materia_id }
                });
            }
            
            // Verificar que el estudiante exista
            const estudianteCheck = await pool.query(
                'SELECT id, nombre FROM estudiantes WHERE id = $1',
                [estudianteIdNum]
            );
            if (estudianteCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Estudiante no encontrado' });
            }
            
            // Verificar que la materia exista y el profesor tenga permisos
            const materiaCheck = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1',
                [materiaIdNum]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Calificaciones a guardar
            const calificaciones = [
                { tipo: 'tarea', calificacion: parseFloat(tareas) || 0 },
                { tipo: 'examen', calificacion: parseFloat(examenes) || 0 },
                { tipo: 'participacion', calificacion: parseFloat(participacion) || 0 },
                { tipo: 'proyecto', calificacion: parseFloat(proyectos) || 0 },
                { tipo: 'practica', calificacion: parseFloat(practicas) || 0 }
            ];
            
            // Guardar cada calificación
            for (const cal of calificaciones) {
                if (cal.calificacion >= 0 && cal.calificacion <= 10) {
                    await pool.query(`
                        INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (estudiante_id, materia_id, tipo) 
                        DO UPDATE SET calificacion = $4, updated_at = NOW()
                    `, [estudianteIdNum, materiaIdNum, cal.tipo, cal.calificacion]);
                }
            }
            
            // Calcular y guardar calificación final
            const calificacionFinal = this.calcularFinal({
                tareas: parseFloat(tareas) || 0,
                examenes: parseFloat(examenes) || 0,
                participacion: parseFloat(participacion) || 0,
                proyectos: parseFloat(proyectos) || 0,
                practicas: parseFloat(practicas) || 0
            });
            
            await pool.query(`
                INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                VALUES ($1, $2, 'final', $3, NOW())
                ON CONFLICT (estudiante_id, materia_id, tipo) 
                DO UPDATE SET calificacion = $3, updated_at = NOW()
            `, [estudianteIdNum, materiaIdNum, calificacionFinal]);
            
            console.log('✅ Calificaciones guardadas para estudiante:', estudianteIdNum);
            res.json({ 
                message: 'Calificaciones guardadas correctamente',
                calificacion_final: calificacionFinal
            });
            
        } catch (error) {
            console.error('❌ Error en guardarCalificacionesAlumno:', error);
            res.status(500).json({ message: 'Error al guardar calificaciones', error: error.message });
        }
    },
    
    // Función auxiliar para calcular calificación final
    calcularFinal(calificaciones) {
        const {
            tareas = 0,
            examenes = 0,
            participacion = 0,
            proyectos = 0,
            practicas = 0
        } = calificaciones;
        
        const final = (
            (proyectos * 0.30) +
            (examenes * 0.30) +
            (participacion * 0.10) +
            (tareas * 0.20) +
            (practicas * 0.10)
        );
        
        return Math.max(0, Math.min(10, final));
    }
};

module.exports = calificacionController;
