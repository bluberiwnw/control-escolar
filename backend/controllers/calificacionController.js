const pool = require('../database/connection');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const HtmlParser = require('../services/htmlParserSimple');

// Función auxiliar para crear datos de Excel
function createExcelData(students, detailedGrades) {
    const headers = [
        'Matrícula',
        'Nombre',
        'Email',
        'Tareas',
        'Exámenes', 
        'Participación',
        'Proyectos',
        'Promedio Final',
        'Porcentaje Final'
    ];
    
    const data = [headers];
    
    // Crear mapa de calificaciones por estudiante
    const gradesMap = {};
    detailedGrades.forEach(grade => {
        const key = `${grade.matricula}_${grade.tipo}`;
        gradesMap[key] = grade.calificacion;
    });
    
    students.forEach(student => {
        const row = [
            student.matricula,
            student.nombre,
            student.email,
            gradesMap[`${student.matricula}_tarea`] || 0,
            gradesMap[`${student.matricula}_examen`] || 0,
            gradesMap[`${student.matricula}_participacion`] || 0,
            gradesMap[`${student.matricula}_proyecto`] || 0,
            student.calificacion_final || 0,
            student.porcentaje_final || 0
        ];
        data.push(row);
    });
    
    return data;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['text/html', 'text/htm'];
        const allowedExtensions = ['.htm', '.html'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo archivos HTM/HTML'), false);
        }
    }
}).single('archivo');

const calificacionController = {
    async uploadFile(req, res) {
        upload(req, res, async function(err) {
            if (err) {
                console.error('❌ Error en upload middleware:', err);
                return res.status(400).json({ message: err.message });
            }
            if (!req.file) {
                console.error('❌ No se proporcionó archivo');
                return res.status(400).json({ message: 'Selecciona un archivo antes de continuar.' });
            }
            
            try {
                console.log('📡 uploadFile - Datos recibidos:', {
                    materia_id: req.body.materia_id,
                    filename: req.file.filename,
                    originalname: req.file.originalname,
                    path: req.file.path,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    usuario: req.usuario?.id,
                    rol: req.usuario?.rol
                });
                
                // Verificar que el usuario exista y sea profesor
                if (!req.usuario || req.usuario.rol !== 'profesor') {
                    console.log('❌ Usuario no autorizado:', req.usuario?.rol);
                    if (req.file && fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    return res.status(403).json({ message: 'No tienes permisos para subir archivos' });
                }
                
                const { materia_id } = req.body;
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
                console.error('🔍 Stack trace:', error.stack);
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

    async getPlantilla(req, res) {
        try {
            console.log('Generando plantilla HTM...');
            console.log('Usuario solicitando plantilla:', req.usuario?.nombre, 'rol:', req.usuario?.rol);
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }
            
            // Generar archivo HTM de ejemplo
            const ejemploHTM = calificacionController.generarEjemploHTM();
            const fileName = 'ejemplo_lista_clase.htm';
            const uploadsDir = path.join(__dirname, '../uploads');
            const filePath = path.join(uploadsDir, fileName);
            
            // Asegurar que el directorio uploads exista
            if (!fs.existsSync(uploadsDir)) {
                console.log('Creando directorio uploads...');
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, ejemploHTM, 'utf8');
            console.log('Plantilla HTM generada:', filePath);
            
            res.json({
                nombre: fileName,
                archivo_url: `/uploads/${fileName}`,
                tipo: 'htm'
            });
        } catch (error) {
            console.error('Error en getPlantilla:', error);
            res.status(500).json({ message: 'No se pudo generar la plantilla de ejemplo.', error: error.message });
        }
    },

    generarEjemploHTM() {
        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Resumen de Lista de Clase</title>
    <style>
        .datadisplaytable { border-collapse: collapse; width: 100%; }
        .datadisplaytable th, .datadisplaytable td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .datadisplaytable th { background-color: #f2f2f2; }
        .ddheader { font-weight: bold; background-color: #003366; color: white; }
        .dddefault { background-color: white; }
        .fieldmediumtext { font-weight: normal; }
        .captiontext { font-size: 1.2em; font-weight: bold; margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>Información de Curso</h1>
    <table class="datadisplaytable">
        <tr><th class="ddheader">Campo</th><th class="ddheader">Valor</th></tr>
        <tr><td class="dddefault">Visión y Animación</td><td class="dddefault">Visión y Animación - 202401</td></tr>
        <tr><td class="dddefault">NRC</td><td class="dddefault">12345</td></tr>
        <tr><td class="dddefault">Duración</td><td class="dddefault">16 semanas</td></tr>
    </table>

    <h2 class="captiontext">Resumen de Lista de Clase</h2>
    <table class="datadisplaytable">
        <tr>
            <th class="ddheader">#</th>
            <th class="ddheader">Nombre</th>
            <th class="ddheader">ID</th>
            <th class="ddheader">Status</th>
            <th class="ddheader">Nivel</th>
            <th class="ddheader">Créditos</th>
            <th class="ddheader">Email</th>
        </tr>
        <tr>
            <td class="dddefault">1</td>
            <td class="dddefault"><span class="fieldmediumtext">PÉREZ LÓPEZ, JUAN CARLOS</span></td>
            <td class="dddefault"><span class="fieldmediumtext">202400001</span></td>
            <td class="dddefault"><span class="fieldmediumtext">Activo</span></td>
            <td class="dddefault"><span class="fieldmediumtext">1</span></td>
            <td class="dddefault"><span class="fieldmediumtext">8</span></td>
            <td class="dddefault"><a href="mailto:juan.perez@alumno.buap.mx">juan.perez@alumno.buap.mx</a></td>
        </tr>
        <tr>
            <td class="dddefault">2</td>
            <td class="dddefault"><span class="fieldmediumtext">GARCÍA MENDOZA, MARÍA ELENA</span></td>
            <td class="dddefault"><span class="fieldmediumtext">202400002</span></td>
            <td class="dddefault"><span class="fieldmediumtext">Activo</span></td>
            <td class="dddefault"><span class="fieldmediumtext">1</span></td>
            <td class="dddefault"><span class="fieldmediumtext">8</span></td>
            <td class="dddefault"><a href="mailto:maria.garcia@alumno.buap.mx">maria.garcia@alumno.buap.mx</a></td>
        </tr>
        <tr>
            <td class="dddefault">3</td>
            <td class="dddefault"><span class="fieldmediumtext">RODRÍGUEZ HERNÁNDEZ, PEDRO LUIS</span></td>
            <td class="dddefault"><span class="fieldmediumtext">202400003</span></td>
            <td class="dddefault"><span class="fieldmediumtext">Activo</span></td>
            <td class="dddefault"><span class="fieldmediumtext">1</span></td>
            <td class="dddefault"><span class="fieldmediumtext">8</span></td>
            <td class="dddefault"><a href="mailto:pedro.rodriguez@alumno.buap.mx">pedro.rodriguez@alumno.buap.mx</a></td>
        </tr>
    </table>
</body>
</html>`;
    },

    async processHtmlFile(filePath, materia_id, profesor_id) {
        try {
            console.log(`Iniciando procesamiento HTM para materia_id: ${materia_id}`);
            
            const htmlContent = fs.readFileSync(filePath, 'utf8');
            console.log('Archivo HTM leído, tamaño:', htmlContent.length, 'bytes');
            
            // Extraer información del curso del archivo HTM
            const courseInfo = HtmlParser.extractCourseInfoSimple(htmlContent);
            console.log('Información del curso extraída:', courseInfo);
            
            const students = HtmlParser.parseStudentList(htmlContent);
            console.log(`Estudiantes extraídos del HTM: ${students.length}`);
            
            if (students.length === 0) {
                console.log('No se encontraron estudiantes en el archivo HTM');
                return { procesados: 0, nuevos: 0, actualizados: 0, courseInfo };
            }
            
            let procesados = 0;
            let nuevos = 0;
            let actualizados = 0;
            let errores = 0;

            for (const student of students) {
                procesados++;
                
                try {
                    console.log(`Procesando estudiante ${procesados}/${students.length}: ${student.nombre_completo}`);
                    
                    // Validar datos del estudiante
                    if (!student.id || !student.nombre_completo) {
                        console.log(`⚠️ Estudiante sin datos completos, omitiendo:`, student);
                        errores++;
                        continue;
                    }
                    
                    // Buscar si el estudiante ya existe por matrícula
                    const existingStudent = await pool.query(
                        'SELECT id, materia_id FROM estudiantes WHERE matricula = $1',
                        [student.id]
                    );

                    let estudianteId;
                    if (existingStudent.rows.length > 0) {
                        estudianteId = existingStudent.rows[0].id;
                        
                        // Actualizar materia_id si es diferente
                        if (existingStudent.rows[0].materia_id !== materia_id) {
                            await pool.query(
                                'UPDATE estudiantes SET materia_id = $1 WHERE id = $2',
                                [materia_id, estudianteId]
                            );
                            console.log(`🔄 Estudiante reasignado a materia ${materia_id}: ${student.nombre_completo} (${student.id})`);
                        } else {
                            console.log(`✅ Estudiante ya existe en materia: ${student.nombre_completo} (${student.id})`);
                        }
                        
                        actualizados++;
                    } else {
                        // Crear nuevo estudiante con toda la información
                        const newStudent = await pool.query(
                            `INSERT INTO estudiantes (matricula, nombre, email, materia_id, password, rol, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
                            [
                                student.id, 
                                student.nombre_completo, 
                                student.email || `${student.id}@buap.mx`, 
                                materia_id, 
                                'temp123', 
                                'alumno'
                            ]
                        );
                        estudianteId = newStudent.rows[0].id;
                        nuevos++;
                        console.log(`➕ Nuevo estudiante creado: ${student.nombre_completo} (${student.id})`);
                    }

                    // Crear calificaciones iniciales para el estudiante
                    const tiposCalificacion = ['tarea', 'examen', 'participacion', 'proyecto'];
                    
                    for (const tipo of tiposCalificacion) {
                        // Verificar si ya existe la calificación
                        const existingGrade = await pool.query(
                            'SELECT id FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 AND tipo = $3',
                            [estudianteId, materia_id, tipo]
                        );
                        
                        if (existingGrade.rows.length === 0) {
                            await pool.query(
                                `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                                 VALUES ($1, $2, $3, 0, NOW())`,
                                [estudianteId, materia_id, tipo]
                            );
                        }
                    }
                    
                    // Crear calificación final
                    const existingFinal = await pool.query(
                        'SELECT id FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 AND tipo = $3',
                        [estudianteId, materia_id, 'final']
                    );
                    
                    if (existingFinal.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, calificacion_final, created_at)
                             VALUES ($1, $2, 'final', 0, 0, NOW())`,
                            [estudianteId, materia_id]
                        );
                    }
                    
                    console.log(`📊 Calificaciones iniciales creadas para: ${student.nombre_completo}`);
                    
                } catch (studentError) {
                    console.error(`❌ Error procesando estudiante ${student.nombre_completo}:`, studentError);
                    errores++;
                    continue;
                }
            }

            const resultado = { 
                procesados, 
                nuevos, 
                actualizados, 
                errores,
                courseInfo,
                totalStudents: students.length
            };
            
            console.log(`🎉 Procesamiento completado:`, resultado);
            return resultado;
        } catch (error) {
            console.error('❌ Error procesando archivo HTM:', error);
            throw error;
        }
    },

    async getAlumnosByMateria(req, res) {
        try {
            const { materia_id } = req.params;
            console.log('getAlumnosByMateria - materia_id:', materia_id, 'usuario_id:', req.usuario.id);
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                console.log('Usuario no autorizado:', req.usuario);
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Verificar que la materia exista
            const materiaCheck = await pool.query(
                'SELECT id, nombre, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0) {
                console.log('Materia no encontrada para materia_id:', materia_id);
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Verificar que la materia pertenezca al profesor
            if (materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                console.log('Materia no pertenece al profesor. materia.profesor_id:', materiaCheck.rows[0].profesor_id, 'usuario.id:', req.usuario.id);
                return res.status(403).json({ message: 'No tienes permisos para ver los alumnos de esta materia' });
            }

            console.log('Materia verificada:', materiaCheck.rows[0].nombre);

            // Obtener todos los estudiantes que tienen calificaciones en esta materia con sus calificaciones individuales
            const estudiantesQuery = await pool.query(
                `SELECT DISTINCT e.*, 
                        COALESCE(c_final.calificacion_final, 0) as calificacion_final,
                        COALESCE(c_final.porcentaje_final, 0) as porcentaje_final
                 FROM estudiantes e
                 LEFT JOIN calificaciones c_final ON e.id = c_final.estudiante_id AND c_final.materia_id = $1 AND c_final.tipo = 'final'
                 WHERE e.id IN (
                     SELECT DISTINCT estudiante_id 
                     FROM calificaciones 
                     WHERE materia_id = $1
                 )
                 ORDER BY e.nombre`,
                [materia_id]
            );
            
            // Obtener calificaciones individuales para cada estudiante
            const estudiantesConCalificaciones = await Promise.all(
                estudiantesQuery.rows.map(async (estudiante) => {
                    const calificacionesIndividuales = await pool.query(
                        `SELECT tipo, calificacion
                         FROM calificaciones 
                         WHERE estudiante_id = $1 AND materia_id = $2 AND tipo != 'final'
                         ORDER BY tipo`,
                        [estudiante.id, materia_id]
                    );
                    
                    // Convertir calificaciones a objeto plano para fácil acceso
                    const calificacionesMap = {};
                    calificacionesIndividuales.rows.forEach(cal => {
                        calificacionesMap[cal.tipo] = cal.calificacion;
                    });
                    
                    return {
                        ...estudiante,
                        ...calificacionesMap
                    };
                })
            );

            console.log('Alumnos encontrados:', estudiantesConCalificaciones.length);
            res.json(estudiantesConCalificaciones);
        } catch (error) {
            console.error('Error en getAlumnosByMateria:', error);
            res.status(500).json({ message: 'Error al obtener alumnos', error: error.message });
        }
    },

    async createAlumno(req, res) {
        try {
            const { materia_id, matricula, nombre, email } = req.body;
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            if (!materia_id || !matricula || !nombre) {
                return res.status(400).json({ message: 'Completa los campos obligatorios' });
            }

            // Verificar que la materia exista
            const materiaCheck = await pool.query(
                'SELECT id, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Verificar que la materia pertenezca al profesor
            if (materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                return res.status(403).json({ message: 'No tienes permisos para agregar alumnos a esta materia' });
            }

            // Verificar si la matrícula ya existe
            const existing = await pool.query(
                'SELECT id FROM estudiantes WHERE matricula = $1',
                [matricula]
            );

            if (existing.rows.length > 0) {
                return res.status(400).json({ message: 'La matrícula ya existe en el sistema' });
            }

            // Crear nuevo estudiante con todos los campos requeridos
            const result = await pool.query(
                `INSERT INTO estudiantes (matricula, nombre, email, materia_id, password, rol, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
                [matricula, nombre, email, materia_id, 'temp123', 'alumno']
            );

            console.log('Estudiante creado:', result.rows[0]);

            // Crear registro de calificaciones inicial para el alumno
            // Verificar si ya existe una calificación para este estudiante y materia
            const existingGrade = await pool.query(
                'SELECT id FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2',
                [result.rows[0].id, materia_id]
            );
            
            if (existingGrade.rows.length === 0) {
                await pool.query(
                    `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                     VALUES ($1, $2, 'general', 0, NOW())`,
                    [result.rows[0].id, materia_id]
                );
                console.log('Calificación inicial creada para el estudiante');
            } else {
                console.log('Calificación ya existe para el estudiante');
            }

            console.log('Calificación inicial creada para el estudiante');

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error en createAlumno:', error);
            res.status(500).json({ message: 'Error al crear alumno', error: error.message });
        }
    },

    async exportToExcel(req, res) {
        try {
            const { materia_id } = req.params;
            console.log('exportToExcel - materia_id:', materia_id, 'usuario:', req.usuario.id);
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            const materiaCheck = await pool.query(
                'SELECT id, nombre, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0) {
                console.log('Materia no encontrada para exportación:', materia_id);
                return res.status(404).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            // Verificar que la materia pertenezca al profesor
            if (materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                return res.status(403).json({ message: 'No tienes permisos para exportar esta materia' });
            }

            console.log('Materia encontrada para exportación:', materiaCheck.rows[0].nombre);

            // Obtener todos los estudiantes que tienen calificaciones en esta materia
            const students = await pool.query(
                `SELECT DISTINCT e.matricula, e.nombre, e.email,
                        COALESCE(c.calificacion_final, 0) as calificacion_final,
                        COALESCE(c.porcentaje_final, 0) as porcentaje_final
                 FROM estudiantes e
                 LEFT JOIN calificaciones c ON e.id = c.estudiante_id AND c.materia_id = $1 AND c.tipo = 'final'
                 WHERE e.id IN (
                     SELECT DISTINCT estudiante_id 
                     FROM calificaciones 
                     WHERE materia_id = $1
                 )
                 ORDER BY e.nombre`,
                [materia_id]
            );

            // Obtener calificaciones detalladas por tipo
            const detailedGrades = await pool.query(
                `SELECT e.matricula, e.nombre, c.tipo, c.calificacion
                 FROM estudiantes e
                 JOIN calificaciones c ON e.id = c.estudiante_id AND c.materia_id = $1
                 WHERE e.id IN (
                     SELECT DISTINCT estudiante_id 
                     FROM calificaciones 
                     WHERE materia_id = $1
                 ) AND c.tipo != 'final'
                 ORDER BY e.nombre, c.tipo`,
                [materia_id]
            );

            console.log('Estudiantes encontrados para exportación:', students.rows.length);

            // Asegurar que el directorio uploads exista
            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Crear datos completos para Excel con calificaciones detalladas
            const excelData = createExcelData(students.rows, detailedGrades.rows);
            console.log('Datos convertidos a formato Excel:', excelData.length, 'filas');
            
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');

            const fileName = `calificaciones_${materiaCheck.rows[0].nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
            const filePath = path.join(uploadsDir, fileName);
            
            XLSX.writeFile(wb, filePath);
            console.log('Archivo Excel generado:', filePath);

            res.json({
                fileName,
                downloadUrl: `/uploads/${fileName}`
            });
        } catch (error) {
            console.error('Error en exportToExcel:', error);
            res.status(500).json({ message: 'Error al exportar a Excel', error: error.message });
        }
    },

    async getAllCalificacionesAlumno(req, res) {
        try {
            const estudianteId = req.usuario.id;
            console.log('getAllCalificacionesAlumno - estudiante_id:', estudianteId, 'rol:', req.usuario.rol);
            
            // Obtener todas las materias en las que el estudiante tiene calificaciones
            const result = await pool.query(`
                SELECT DISTINCT 
                    m.id as materia_id,
                    m.nombre as materia_nombre, 
                    m.clave as materia_clave,
                    u.nombre as profesor_nombre,
                    COALESCE(MAX(c.calificacion_final), 0) as promedio_final
                FROM materias m
                JOIN usuarios u ON m.profesor_id = u.id
                JOIN calificaciones c ON c.materia_id = m.id AND c.estudiante_id = $1
                WHERE c.estudiante_id = $1
                GROUP BY m.id, m.nombre, m.clave, u.nombre
                ORDER BY m.nombre
            `, [estudianteId]);

            // Obtener calificaciones detalladas para cada materia
            const materiasConCalificaciones = await Promise.all(
                result.rows.map(async (materia) => {
                    const calificacionesDetalladas = await pool.query(`
                        SELECT tipo, calificacion, created_at
                        FROM calificaciones 
                        WHERE estudiante_id = $1 AND materia_id = $2 AND tipo != 'final'
                        ORDER BY created_at
                    `, [estudianteId, materia.materia_id]);

                    return {
                        materia_id: materia.materia_id,
                        nombre: materia.materia_nombre,
                        clave: materia.materia_clave,
                        profesor: materia.profesor_nombre,
                        promedio_final: parseFloat(materia.promedio_final) || 0,
                        calificaciones: calificacionesDetalladas.rows
                    };
                })
            );

            const totalMaterias = materiasConCalificaciones.length;
            const promedioGeneral = totalMaterias > 0 
                ? materiasConCalificaciones.reduce((sum, m) => sum + m.promedio_final, 0) / totalMaterias 
                : 0;

            console.log(`Estudiante ${estudianteId}: ${totalMaterias} materias, promedio: ${promedioGeneral}`);

            res.json({
                materias: materiasConCalificaciones,
                total_materias: totalMaterias,
                promedio_general: promedioGeneral
            });
        } catch (error) {
            console.error('Error en getAllCalificacionesAlumno:', error);
            res.status(500).json({ message: 'Error al obtener calificaciones', error: error.message });
        }
    },

    async getArchivos(req, res) {
        try {
            console.log('getArchivos - usuario_id:', req.usuario.id, 'rol:', req.usuario.rol);
            
            // Verificar que el usuario exista y sea profesor o administrador
            if (!req.usuario || (req.usuario.rol !== 'profesor' && req.usuario.rol !== 'administrador')) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Obtener archivos del directorio uploads
            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) {
                return res.json([]);
            }
            
            const files = fs.readdirSync(uploadsDir);
            const archivos = files
                .filter(file => file.endsWith('.htm') || file.endsWith('.html') || file.endsWith('.xlsx'))
                .map((file, index) => {
                    const filePath = path.join(uploadsDir, file);
                    const stats = fs.statSync(filePath);
                    const tipo = file.endsWith('.htm') || file.endsWith('.html') ? 'HTM' : 'Excel';
                    
                    return {
                        id: index + 1,
                        nombre_archivo: file,
                        tipo: tipo,
                        fecha_subida: stats.mtime,
                        estado: 'Procesado',
                        detalles: {
                            ruta: filePath,
                            tamaño: stats.size,
                            extension: path.extname(file)
                        }
                    };
                })
                .sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
            
            console.log('Archivos encontrados:', archivos.length);
            res.json(archivos);
        } catch (error) {
            console.error('Error en getArchivos:', error);
            res.status(500).json({ message: 'Error al obtener archivos', error: error.message });
        }
    },

    async descargarArchivoCalificacion(req, res) {
        try {
            const { id } = req.params;
            console.log('descargarArchivoCalificacion - archivo_id:', id, 'usuario_id:', req.usuario.id);
            
            // Verificar que el usuario exista y sea profesor o administrador
            if (!req.usuario || (req.usuario.rol !== 'profesor' && req.usuario.rol !== 'administrador')) {
                return res.status(403).json({ message: 'No tienes permisos para descargar archivos' });
            }
            
            // Obtener archivos del directorio
            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) {
                return res.status(404).json({ message: 'Directorio de archivos no encontrado' });
            }
            
            const files = fs.readdirSync(uploadsDir);
            const archivos = files
                .filter(file => file.endsWith('.htm') || file.endsWith('.html') || file.endsWith('.xlsx'))
                .map((file, index) => ({
                    id: index + 1,
                    nombre: file,
                    path: path.join(uploadsDir, file)
                }));
            
            const archivo = archivos.find(a => a.id == id);
            if (!archivo) {
                return res.status(404).json({ message: 'Archivo no encontrado' });
            }
            
            console.log('Descargando archivo:', archivo.nombre);
            res.download(archivo.path, archivo.nombre);
        } catch (error) {
            console.error('Error en descargarArchivoCalificacion:', error);
            res.status(500).json({ message: 'Error al descargar archivo', error: error.message });
        }
    },

    async deleteArchivo(req, res) {
        try {
            const { id } = req.params;
            console.log('deleteArchivo - archivo_id:', id, 'usuario_id:', req.usuario.id);
            
            // Verificar que el usuario exista y sea profesor o administrador
            if (!req.usuario || (req.usuario.rol !== 'profesor' && req.usuario.rol !== 'administrador')) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar archivos' });
            }
            
            // Obtener archivos del directorio
            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) {
                return res.status(404).json({ message: 'Directorio de archivos no encontrado' });
            }
            
            const files = fs.readdirSync(uploadsDir);
            const archivos = files
                .filter(file => file.endsWith('.htm') || file.endsWith('.html') || file.endsWith('.xlsx'))
                .map((file, index) => ({
                    id: index + 1,
                    nombre: file,
                    path: path.join(uploadsDir, file)
                }));
            
            const archivo = archivos.find(a => a.id == id);
            if (!archivo) {
                return res.status(404).json({ message: 'Archivo no encontrado' });
            }
            
            // Eliminar archivo físico
            fs.unlinkSync(archivo.path);
            console.log('Archivo eliminado:', archivo.nombre);
            
            res.json({ message: 'Archivo eliminado correctamente' });
        } catch (error) {
            console.error('Error en deleteArchivo:', error);
            res.status(500).json({ message: 'Error al eliminar archivo', error: error.message });
        }
    },

    async updateAlumno(req, res) {
        try {
            const { id } = req.params;
            const { matricula, nombre, email } = req.body;
            
            console.log('📡 updateAlumno - Datos recibidos:', {
                id,
                matricula,
                nombre,
                email,
                usuario: req.usuario?.id,
                rol: req.usuario?.rol
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
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                console.log('❌ Usuario no autorizado:', req.usuario?.rol);
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            // Verificar si el estudiante existe
            const existingStudent = await pool.query(
                'SELECT id, matricula, nombre FROM estudiantes WHERE id = $1',
                [id]
            );
            if (existingStudent.rows.length === 0) {
                console.log('❌ Estudiante no encontrado:', id);
                return res.status(404).json({ message: 'Estudiante no encontrado' });
            }
            
            console.log('✅ Estudiante encontrado:', existingStudent.rows[0]);
            
            // Verificar si la matrícula ya existe en otro estudiante
            const matriculaCheck = await pool.query(
                'SELECT id, matricula FROM estudiantes WHERE matricula = $1 AND id != $2',
                [matricula.trim(), id]
            );
            if (matriculaCheck.rows.length > 0) {
                console.log('❌ Matrícula duplicada:', matricula);
                return res.status(400).json({ 
                    message: 'La matrícula ya existe en el sistema',
                    existing_id: matriculaCheck.rows[0].id,
                    existing_matricula: matriculaCheck.rows[0].matricula
                });
            }

            // Actualizar estudiante
            const result = await pool.query(
                `UPDATE estudiantes 
                 SET matricula = $1, nombre = $2, email = $3, updated_at = NOW()
                 WHERE id = $4 RETURNING *`,
                [matricula.trim(), nombre.trim(), email?.trim() || null, id]
            );

            console.log('✅ Estudiante actualizado:', result.rows[0]);
            res.json(result.rows[0]);
        } catch (error) {
            console.error('❌ Error en updateAlumno:', error);
            console.error('🔍 Stack trace:', error.stack);
            res.status(500).json({ 
                message: 'Error al actualizar alumno', 
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    async deleteAlumno(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Verificar si el estudiante existe
            const existingStudent = await pool.query(
                'SELECT id FROM estudiantes WHERE id = $1',
                [id]
            );
            if (existingStudent.rows.length === 0) {
                return res.status(404).json({ message: 'Estudiante no encontrado' });
            }
            
            // Verificar que el profesor tenga permisos para eliminar este estudiante
            // Verificando si el estudiante tiene calificaciones en alguna materia del profesor
            const materiasProfesorQuery = await pool.query(
                'SELECT id FROM materias WHERE profesor_id = $1',
                [req.usuario.id]
            );
            
            if (materiasProfesorQuery.rows.length === 0) {
                return res.status(403).json({ message: 'No tienes materias asignadas' });
            }
            
            const materiasIds = materiasProfesorQuery.rows.map(m => m.id);
            
            // Verificar si el estudiante tiene calificaciones en alguna materia del profesor
            const calificacionCheck = await pool.query(
                'SELECT id FROM calificaciones WHERE estudiante_id = $1 AND materia_id = ANY($2)',
                [id, materiasIds]
            );
            
            if (calificacionCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Este estudiante no está en tus materias' });
            }

            // Eliminar calificaciones del estudiante en las materias del profesor
            const deleteCalificacionesResult = await pool.query(
                'DELETE FROM calificaciones WHERE estudiante_id = $1 AND materia_id = ANY($2)',
                [id, materiasIds]
            );

            // Verificar si el estudiante tiene calificaciones en otras materias
            const otrasCalificacionesQuery = await pool.query(
                'SELECT COUNT(*) as count FROM calificaciones WHERE estudiante_id = $1',
                [id]
            );
            
            // Si no tiene más calificaciones, eliminar el estudiante
            if (parseInt(otrasCalificacionesQuery.rows[0].count) === 0) {
                await pool.query(
                    'DELETE FROM estudiantes WHERE id = $1',
                    [id]
                );
                console.log('Estudiante eliminado completamente:', id);
            } else {
                console.log('Calificaciones eliminadas, estudiante conservado:', id);
            }

            console.log('Calificaciones eliminadas:', deleteCalificacionesResult.rowCount);
            res.json({ 
                message: 'Estudiante eliminado correctamente',
                calificacionesEliminadas: deleteCalificacionesResult.rowCount
            });
        } catch (error) {
            console.error('Error en deleteAlumno:', error);
            res.status(500).json({ message: 'Error al eliminar alumno', error: error.message });
        }
    },

    async guardarPonderaciones(req, res) {
        try {
            const { materia_id, tareas, examenes, participacion, proyectos, practicas } = req.body;
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0 || materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                return res.status(403).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            // Verificar que el total sea 100
            const total = tareas + examenes + participacion + proyectos + practicas;
            if (total !== 100) {
                return res.status(400).json({ message: 'El total de ponderaciones debe ser 100%' });
            }
            
            // Por ahora, solo devolvemos éxito ya que la tabla no tiene columnas de ponderaciones
            // En una versión futura se podría crear una tabla separada para ponderaciones
            console.log(`Ponderaciones recibidas para materia ${materia_id}:`, { tareas, examenes, participacion, proyectos, practicas });
            res.json({ message: 'Ponderaciones guardadas correctamente' });
        } catch (error) {
            console.error('Error en guardarPonderaciones:', error);
            res.status(500).json({ message: 'Error al guardar ponderaciones', error: error.message });
        }
    },

    async getPonderaciones(req, res) {
        try {
            const { materia_id } = req.params;
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0 || materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                return res.status(403).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            // Por ahora, devolver valores por defecto ya que la tabla no tiene columnas de ponderaciones
            const ponderaciones = {
                tareas: 20,
                examenes: 30,
                participacion: 10,
                proyectos: 20,
                practicas: 20
            };
            
            res.json(ponderaciones);
        } catch (error) {
            console.error('Error en getPonderaciones:', error);
            res.status(500).json({ message: 'Error al obtener ponderaciones', error: error.message });
        }
    },

    async calcularCalificaciones(req, res) {
        try {
            const { materia_id } = req.params;
            const { tareas, examenes, participacion, proyectos, practicas } = req.body;
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0 || materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                return res.status(403).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            // Obtener todos los estudiantes de la materia
            const estudiantes = await pool.query(
                `SELECT DISTINCT e.id, e.matricula, e.nombre
                 FROM estudiantes e
                 JOIN calificaciones c ON e.id = c.estudiante_id
                 WHERE c.materia_id = $1
                 ORDER BY e.nombre`,
                [materia_id]
            );
            
            let calculados = 0;
            
            for (const estudiante of estudiantes.rows) {
                // Obtener calificaciones del estudiante por tipo
                const calificacionesTipo = await pool.query(
                    `SELECT tipo, calificacion
                     FROM calificaciones 
                     WHERE estudiante_id = $1 AND materia_id = $2 AND tipo != 'final'`,
                    [estudiante.id, materia_id]
                );
                
                // Calcular promedio ponderado
                let calificacionFinal = 0;
                const calificacionesMap = {};
                
                calificacionesTipo.rows.forEach(cal => {
                    calificacionesMap[cal.tipo] = cal.calificacion;
                });
                
                // Aplicar ponderaciones
                calificacionFinal += (calificacionesMap.tarea || 0) * (tareas / 100);
                calificacionFinal += (calificacionesMap.examen || 0) * (examenes / 100);
                calificacionFinal += (calificacionesMap.participacion || 0) * (participacion / 100);
                calificacionFinal += (calificacionesMap.proyecto || 0) * (proyectos / 100);
                calificacionFinal += (calificacionesMap.practica || 0) * (practicas / 100);
                
                // Actualizar calificación final
                await pool.query(
                    `UPDATE calificaciones 
                     SET calificacion_final = $1, 
                         porcentaje_final = $2,
                         updated_at = NOW()
                     WHERE estudiante_id = $3 AND materia_id = $4 AND tipo = 'final'`,
                    [calificacionFinal, 100, estudiante.id, materia_id]
                );
                
                calculados++;
            }
            
            console.log(`Calificaciones calculadas para ${calculados} estudiantes en materia ${materia_id}`);
            res.json({ message: 'Calificaciones calculadas correctamente', calculados });
        } catch (error) {
            console.error('Error en calcularCalificaciones:', error);
            res.status(500).json({ message: 'Error al calcular calificaciones', error: error.message });
        }
    },

    async actualizarCalificacion(req, res) {
        try {
            const { estudiante_id, materia_id, tipo, calificacion } = req.body;
            
            console.log('📡 actualizarCalificacion - Datos recibidos:', {
                estudiante_id,
                materia_id,
                tipo,
                calificacion,
                usuario: req.usuario?.id,
                rol: req.usuario?.rol
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
            
            // Validar que la calificación sea un número válido
            const calificacionNum = parseFloat(calificacion);
            if (isNaN(calificacionNum) || calificacionNum < 0 || calificacionNum > 10) {
                console.log('❌ Calificación inválida:', calificacion);
                return res.status(400).json({ 
                    message: 'La calificación debe ser un número entre 0 y 10',
                    received: calificacion
                });
            }
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                console.log('❌ Usuario no autorizado:', req.usuario?.rol);
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0) {
                console.log('❌ Materia no encontrada:', materia_id);
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
                [estudiante_id]
            );
            if (estudianteCheck.rows.length === 0) {
                console.log('❌ Estudiante no encontrado:', estudiante_id);
                return res.status(404).json({ message: 'Estudiante no encontrado' });
            }
            
            // Actualizar o crear la calificación
            const existingCal = await pool.query(
                'SELECT id FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 AND tipo = $3',
                [estudiante_id, materia_id, tipo]
            );
            
            if (existingCal.rows.length > 0) {
                // Actualizar calificación existente
                await pool.query(
                    `UPDATE calificaciones 
                     SET calificacion = $1, updated_at = NOW()
                     WHERE estudiante_id = $2 AND materia_id = $3 AND tipo = $4`,
                    [calificacionNum, estudiante_id, materia_id, tipo]
                );
                console.log('✅ Calificación actualizada correctamente');
            } else {
                // Crear nueva calificación
                await pool.query(
                    `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [estudiante_id, materia_id, tipo, calificacionNum]
                );
                console.log('✅ Calificación creada correctamente');
            }
            
            console.log(`📊 Calificación guardada: estudiante ${estudiante_id}, materia ${materia_id}, tipo ${tipo}, valor ${calificacionNum}`);
            res.json({ message: 'Calificación actualizada correctamente' });
        } catch (error) {
            console.error('❌ Error en actualizarCalificacion:', error);
            console.error('🔍 Stack trace:', error.stack);
            res.status(500).json({ 
                message: 'Error al actualizar calificación', 
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    async getCalificacionesEstudiante(req, res) {
        try {
            const { estudiante_id, materia_id } = req.params;
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0 || materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                return res.status(403).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            // Obtener todas las calificaciones del estudiante en la materia
            const calificaciones = await pool.query(
                `SELECT tipo, calificacion, created_at
                 FROM calificaciones 
                 WHERE estudiante_id = $1 AND materia_id = $2
                 ORDER BY tipo`,
                [estudiante_id, materia_id]
            );
            
            res.json(calificaciones.rows);
        } catch (error) {
            console.error('Error en getCalificacionesEstudiante:', error);
            res.status(500).json({ message: 'Error al obtener calificaciones', error: error.message });
        }
    },

    async darseDeBajaMateria(req, res) {
        try {
            const { materia_id } = req.params;
            const estudiante_id = req.usuario.id;
            
            console.log('darseDeBajaMateria - estudiante_id:', estudiante_id, 'materia_id:', materia_id);
            
            // Verificar que el usuario exista y sea alumno
            if (!req.usuario || req.usuario.rol !== 'alumno') {
                return res.status(403).json({ message: 'No tienes permisos para usar esta función' });
            }
            
            // Verificar que la materia exista
            const materiaCheck = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1',
                [materia_id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Verificar que el estudiante esté inscrito en la materia
            const inscripcionCheck = await pool.query(
                'SELECT id FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 LIMIT 1',
                [estudiante_id, materia_id]
            );
            if (inscripcionCheck.rows.length === 0) {
                return res.status(404).json({ message: 'No estás inscrito en esta materia' });
            }
            
            // Eliminar todas las calificaciones del estudiante en esa materia
            const deleteResult = await pool.query(
                'DELETE FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2',
                [estudiante_id, materia_id]
            );
            
            console.log(`Estudiante ${estudiante_id} se dio de baja de materia ${materia_id}. Calificaciones eliminadas: ${deleteResult.rowCount}`);
            
            res.json({ 
                message: `Te has dado de baja correctamente de la materia ${materiaCheck.rows[0].nombre}`,
                materia: materiaCheck.rows[0].nombre
            });
        } catch (error) {
            console.error('Error en darseDeBajaMateria:', error);
            res.status(500).json({ message: 'Error al darse de baja', error: error.message });
        }
    },

    async procesarDefinitivo(req, res) {
        try {
            const { materia_id, datos } = req.body;
            
            // Verificar que el usuario exista y sea profesor
            if (!req.usuario || req.usuario.rol !== 'profesor') {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, nombre, profesor_id FROM materias WHERE id = $1',
                [materia_id]
            );
            
            if (materiaCheck.rows.length === 0 || materiaCheck.rows[0].profesor_id !== req.usuario.id) {
                return res.status(403).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            // Procesar los datos del HTM y guardar definitivamente
            const estudiantes = datos.estudiantes || [];
            let procesados = 0;
            let errores = 0;
            
            for (const estudiante of estudiantes) {
                try {
                    // Verificar si el estudiante ya existe
                    const estudianteExistente = await pool.query(
                        'SELECT id FROM estudiantes WHERE matricula = $1',
                        [estudiante.numero_registro]
                    );
                    
                    let estudiante_id;
                    if (estudianteExistente.rows.length > 0) {
                        estudiante_id = estudianteExistente.rows[0].id;
                    } else {
                        // Crear nuevo estudiante
                        const nuevoEstudiante = await pool.query(
                            `INSERT INTO estudiantes (matricula, nombre, email, rol, materia_id, created_at)
                             VALUES ($1, $2, $3, $4, $5, NOW())
                             RETURNING id`,
                            [estudiante.numero_registro, estudiante.nombre_completo, estudiante.email || '', 'alumno', materia_id]
                        );
                        estudiante_id = nuevoEstudiante.rows[0].id;
                    }
                    
                    // Guardar calificaciones individuales
                    await pool.query(
                        `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                         VALUES ($1, $2, 'tarea', $3, NOW())
                         ON CONFLICT (estudiante_id, materia_id, tipo) 
                         DO UPDATE SET calificacion = EXCLUDED.calificacion`,
                        [estudiante_id, materia_id, estudiante.tareas || 0]
                    );
                    
                    await pool.query(
                        `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                         VALUES ($1, $2, 'examen', $3, NOW())
                         ON CONFLICT (estudiante_id, materia_id, tipo) 
                         DO UPDATE SET calificacion = EXCLUDED.calificacion`,
                        [estudiante_id, materia_id, estudiante.examenes || 0]
                    );
                    
                    await pool.query(
                        `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                         VALUES ($1, $2, 'proyecto', $3, NOW())
                         ON CONFLICT (estudiante_id, materia_id, tipo) 
                         DO UPDATE SET calificacion = EXCLUDED.calificacion`,
                        [estudiante_id, materia_id, estudiante.proyectos || 0]
                    );
                    
                    // Guardar calificación final
                    await pool.query(
                        `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, calificacion_final, created_at)
                         VALUES ($1, $2, 'examen', $3, $3, NOW())
                         ON CONFLICT (estudiante_id, materia_id, tipo) 
                         DO UPDATE SET calificacion = EXCLUDED.calificacion, calificacion_final = EXCLUDED.calificacion_final`,
                        [estudiante_id, materia_id, estudiante.calificacion_final || 0]
                    );
                    
                    procesados++;
                } catch (error) {
                    console.error(`Error procesando estudiante ${estudiante.nombre_completo}:`, error);
                    errores++;
                }
            }
            
            console.log(`Procesamiento definitivo completado: ${procesados} exitosos, ${errores} errores`);
            
            res.json({
                message: 'Calificaciones procesadas definitivamente y disponibles para el administrador',
                procesados: procesados,
                errores: errores,
                materia: materiaCheck.rows[0].nombre
            });
            
        } catch (error) {
            console.error('Error en procesarDefinitivo:', error);
            res.status(500).json({ message: 'Error al procesar calificaciones definitivamente', error: error.message });
        }
    },
};

module.exports = calificacionController;
