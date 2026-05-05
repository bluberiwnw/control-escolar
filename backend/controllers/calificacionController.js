const pool = require('../database/connection');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { procesarExcelCalificaciones } = require('../services/excelService');
const HtmlParser = require('../services/htmlParserSimple');
const XLSX = require('xlsx');

const TIPOS_CALIFICACION = new Set(['tarea', 'proyecto', 'examen']);

function parseCalificacion(valor) {
    const numero = Number.parseFloat(valor);
    return Number.isNaN(numero) ? null : numero;
}

function mensajeErrorCarga(error) {
    if (error?.code === '23503') {
        return 'La materia o el alumno relacionado ya no existe.';
    }
    return 'No se pudo procesar el archivo de calificaciones.';
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
            if (err) return res.status(400).json({ message: err.message });
            if (!req.file) return res.status(400).json({ message: 'Selecciona un archivo antes de continuar.' });
            try {
                const { materia_id } = req.body;
                if (!materia_id) {
                    fs.unlinkSync(req.file.path);
                    return res.status(400).json({ message: 'Selecciona una materia antes de subir el archivo.' });
                }
                const materiaCheck = await pool.query(
                    'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                    [materia_id, req.usuario.id]
                );
                if (materiaCheck.rows.length === 0) {
                    fs.unlinkSync(req.file.path);
                    return res.status(404).json({ message: 'Materia no encontrada' });
                }
                const insertResult = await pool.query(
                    `INSERT INTO archivos_calificaciones (profesor_id, materia_id, nombre_archivo, tipo)
                     VALUES ($1, $2, $3, $4) RETURNING id`,
                    [req.usuario.id, materia_id, req.file.filename, 'htm']
                );
                let detalles = '';
                let estado = 'Procesado';

                // Procesar archivos HTM
                if (req.file.originalname.match(/\.(htm|html)$/i)) {
                    const resultado = await this.processHtmlFile(req.file.path, materia_id, req.usuario.id);
                    detalles = `Procesados: ${resultado.procesados}, Nuevos: ${resultado.nuevos}, Actualizados: ${resultado.actualizados}`;
                    await pool.query(
                        `UPDATE archivos_calificaciones SET estado = 'Procesado', detalles = $1 WHERE id = $2`,
                        [estado, detalles, insertResult.rows[0].id]
                    );
                }
                res.json({
                    message: 'Archivo HTM procesado correctamente',
                    archivo: {
                        id: insertResult.rows[0].id,
                        nombre: req.file.originalname,
                        archivo_url: `/uploads/${encodeURIComponent(req.file.filename)}`,
                        tipo: 'htm',
                        fecha: new Date().toISOString().split('T')[0],
                        estado,
                        detalles,
                    },
                });
            } catch (error) {
                if (req.file) fs.unlinkSync(req.file.path);
                res.status(500).json({ message: mensajeErrorCarga(error) });
            }
        });
    },

    async getArchivos(req, res) {
        try {
            const result = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre 
                 FROM archivos_calificaciones a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.profesor_id = $1
                 ORDER BY a.fecha_subida DESC`,
                [req.usuario.id]
            );
            res.json(result.rows.map((row) => ({
                ...row,
                archivo_url: `/uploads/${encodeURIComponent(row.nombre_archivo)}`,
            })));
        } catch (error) {
            res.status(500).json({ message: 'No se pudieron cargar los archivos subidos.' });
        }
    },

    async descargarArchivoCalificacion(req, res) {
        try {
            const id = Number.parseInt(req.params.id, 10);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ message: 'ID no válido.' });
            }
            const find =
                req.usuario.rol === 'administrador'
                    ? await pool.query('SELECT nombre_archivo FROM archivos_calificaciones WHERE id = $1', [id])
                    : await pool.query(
                          'SELECT nombre_archivo FROM archivos_calificaciones WHERE id = $1 AND profesor_id = $2',
                          [id, req.usuario.id]
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

    async deleteArchivo(req, res) {
        try {
            const { id } = req.params;
            const result = await pool.query(
                'DELETE FROM archivos_calificaciones WHERE id = $1 AND profesor_id = $2 RETURNING nombre_archivo',
                [id, req.usuario.id]
            );
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Archivo no encontrado' });
            }
            const filename = result.rows[0].nombre_archivo;
            const full = path.join(__dirname, '../uploads', filename);
            if (fs.existsSync(full)) {
                try {
                    fs.unlinkSync(full);
                } catch (_) {
                    /* ignore */
                }
            }
            res.json({ message: 'Archivo eliminado' });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getByMateria(req, res) {
        try {
            const { materia_id } = req.params;
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) return res.status(404).json({ message: 'Materia no encontrada' });
            const result = await pool.query(
                `SELECT c.*, e.nombre, e.matricula, a.titulo as actividad_titulo
                 FROM calificaciones c
                 JOIN estudiantes e ON c.estudiante_id = e.id
                 LEFT JOIN actividades a ON c.actividad_id = a.id
                 WHERE c.materia_id = $1
                 ORDER BY e.nombre, c.tipo`,
                [materia_id]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async save(req, res) {
        try {
            const { materia_id, estudiante_id, actividad_id, tipo, calificacion } = req.body;
            const valor = parseCalificacion(calificacion);
            if (!materia_id || !estudiante_id) {
                return res.status(400).json({ message: 'Completa los campos obligatorios de materia y alumno.' });
            }
            if (!TIPOS_CALIFICACION.has(String(tipo || '').trim())) {
                return res.status(400).json({ message: 'Selecciona un tipo de evaluación válido.' });
            }
            if (valor == null || valor < 5 || valor > 10) {
                return res.status(400).json({ message: 'La calificación debe estar entre 5 y 10.' });
            }
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) return res.status(404).json({ message: 'Materia no encontrada' });
            const insertResult = await pool.query(
                `INSERT INTO calificaciones (materia_id, estudiante_id, actividad_id, tipo, calificacion)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [materia_id, estudiante_id, actividad_id || null, tipo, valor]
            );
            const nueva = await pool.query(
                `SELECT c.*, e.nombre, e.matricula 
                 FROM calificaciones c
                 JOIN estudiantes e ON c.estudiante_id = e.id
                 WHERE c.id = $1`,
                [insertResult.rows[0].id]
            );
            res.status(201).json(nueva.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'No se pudo guardar la calificación.' });
        }
    },

    async getPlantilla(req, res) {
        try {
            // Generar archivo HTM de ejemplo
            const ejemploHTM = this.generarEjemploHTM();
            const fileName = 'ejemplo_lista_clase.htm';
            const filePath = path.join(__dirname, '../uploads', fileName);
            
            fs.writeFileSync(filePath, ejemploHTM, 'utf8');
            
            res.json({
                nombre: fileName,
                archivo_url: `/uploads/${fileName}`,
                tipo: 'htm'
            });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo generar la plantilla de ejemplo.' });
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

    async getEstadisticas(req, res) {
        try {
            const { materia_id } = req.params;
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) return res.status(404).json({ message: 'Materia no encontrada' });
            const promedio = await pool.query('SELECT AVG(calificacion) as promedio FROM calificaciones WHERE materia_id = $1', [materia_id]);
            const distribucion = await pool.query(
                `SELECT 
                    SUM(CASE WHEN calificacion >= 9 THEN 1 ELSE 0 END) as rango_9_10,
                    SUM(CASE WHEN calificacion >= 8 AND calificacion < 9 THEN 1 ELSE 0 END) as rango_8_9,
                    SUM(CASE WHEN calificacion >= 7 AND calificacion < 8 THEN 1 ELSE 0 END) as rango_7_8,
                    SUM(CASE WHEN calificacion >= 6 AND calificacion < 7 THEN 1 ELSE 0 END) as rango_6_7,
                    SUM(CASE WHEN calificacion < 6 THEN 1 ELSE 0 END) as rango_menor_6
                 FROM calificaciones WHERE materia_id = $1`,
                [materia_id]
            );
            const porTipo = await pool.query(
                `SELECT tipo, AVG(calificacion) as promedio, COUNT(*) as cantidad
                 FROM calificaciones WHERE materia_id = $1 GROUP BY tipo`,
                [materia_id]
            );
            res.json({ promedio_general: promedio.rows[0].promedio || 0, distribucion: distribucion.rows[0], por_tipo: porTipo.rows });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async processHtmlFile(filePath, materia_id, profesor_id) {
        try {
            const htmlContent = fs.readFileSync(filePath, 'utf8');
            const students = HtmlParser.parseStudentList(htmlContent);
            
            let procesados = 0;
            let nuevos = 0;
            let actualizados = 0;

            for (const student of students) {
                procesados++;
                
                // Buscar si el estudiante ya existe por matrícula
                const existingStudent = await pool.query(
                    'SELECT id FROM estudiantes WHERE matricula = $1',
                    [student.id]
                );

                let estudianteId;
                if (existingStudent.rows.length > 0) {
                    estudianteId = existingStudent.rows[0].id;
                    actualizados++;
                } else {
                    // Crear nuevo estudiante
                    const newStudent = await pool.query(
                        `INSERT INTO estudiantes (matricula, nombre, email, materia_id, created_at)
                         VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
                        [student.id, student.nombre_completo, student.email, materia_id]
                    );
                    estudianteId = newStudent.rows[0].id;
                    nuevos++;
                }

                // Actualizar o crear calificaciones
                await this.updateStudentGrades(estudianteId, materia_id, student);
            }

            return { procesados, nuevos, actualizados };
        } catch (error) {
            console.error('Error procesando archivo HTM:', error);
            throw error;
        }
    },

    async updateStudentGrades(estudianteId, materiaId, studentData) {
        const tipos = ['participaciones', 'tareas', 'actividades', 'examenes'];
        
        for (const tipo of tipos) {
            const valor = studentData[tipo] || 0;
            if (valor > 0) {
                // Verificar si ya existe una calificación de este tipo
                const existing = await pool.query(
                    'SELECT id FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 AND tipo = $3',
                    [estudianteId, materiaId, tipo.slice(0, -1)] // quitar la 's' final
                );

                if (existing.rows.length > 0) {
                    // Actualizar calificación existente
                    await pool.query(
                        'UPDATE calificaciones SET calificacion = $1, updated_at = NOW() WHERE id = $2',
                        [valor, existing.rows[0].id]
                    );
                } else {
                    // Crear nueva calificación
                    await pool.query(
                        `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                         VALUES ($1, $2, $3, $4, NOW())`,
                        [estudianteId, materiaId, tipo.slice(0, -1), valor]
                    );
                }
            }
        }

        // Calcular y actualizar la calificación final
        const finalGrade = HtmlParser.calculateGrade(
            studentData.participaciones || 0,
            studentData.tareas || 0,
            studentData.actividades || 0,
            studentData.examenes || 0
        );

        await pool.query(
            `UPDATE calificaciones 
             SET calificacion_final = $1, porcentaje_final = $2, updated_at = NOW()
             WHERE estudiante_id = $3 AND materia_id = $4`,
            [finalGrade, (finalGrade * 10), estudianteId, materiaId]
        );
    },

    async getAlumnosByMateria(req, res) {
        try {
            const { materia_id } = req.params;
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }

            const result = await pool.query(
                `SELECT e.*, 
                        COALESCE(c.calificacion_final, 0) as calificacion_final,
                        COALESCE(c.porcentaje_final, 0) as porcentaje_final
                 FROM estudiantes e
                 LEFT JOIN calificaciones c ON e.id = c.estudiante_id AND c.materia_id = $1
                 WHERE e.materia_id = $1
                 ORDER BY e.nombre`,
                [materia_id]
            );

            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener alumnos', error: error.message });
        }
    },

    async createAlumno(req, res) {
        try {
            const { materia_id, matricula, nombre, email } = req.body;
            
            if (!materia_id || !matricula || !nombre) {
                return res.status(400).json({ message: 'Completa los campos obligatorios' });
            }

            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }

            const existing = await pool.query(
                'SELECT id FROM estudiantes WHERE matricula = $1',
                [matricula]
            );

            if (existing.rows.length > 0) {
                return res.status(400).json({ message: 'La matrícula ya existe' });
            }

            const result = await pool.query(
                `INSERT INTO estudiantes (matricula, nombre, email, materia_id, created_at)
                 VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
                [matricula, nombre, email, materia_id]
            );

            // Crear registro de calificaciones inicial para el alumno
            await pool.query(
                `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                 VALUES ($1, $2, 'general', 0, NOW())`,
                [result.rows[0].id, materia_id]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error al crear alumno', error: error.message });
        }
    },

    async updateAlumno(req, res) {
        try {
            const { id } = req.params;
            const { nombre, email } = req.body;

            const result = await pool.query(
                `UPDATE estudiantes 
                 SET nombre = $1, email = $2, updated_at = NOW()
                 WHERE id = $3 AND materia_id IN (
                     SELECT id FROM materias WHERE profesor_id = $4
                 ) RETURNING *`,
                [nombre, email, id, req.usuario.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Alumno no encontrado' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error al actualizar alumno', error: error.message });
        }
    },

    async deleteAlumno(req, res) {
        try {
            const { id } = req.params;

            const result = await pool.query(
                `DELETE FROM estudiantes 
                 WHERE id = $1 AND materia_id IN (
                     SELECT id FROM materias WHERE profesor_id = $2
                 ) RETURNING *`,
                [id, req.usuario.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Alumno no encontrado' });
            }

            res.json({ message: 'Alumno eliminado correctamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error al eliminar alumno', error: error.message });
        }
    },

    async exportToExcel(req, res) {
        try {
            const { materia_id } = req.params;
            const materiaCheck = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }

            const students = await pool.query(
                `SELECT e.matricula, e.nombre, e.email,
                        COALESCE(c.calificacion_final, 0) as calificacion_final,
                        COALESCE(c.porcentaje_final, 0) as porcentaje_final
                 FROM estudiantes e
                 LEFT JOIN calificaciones c ON e.id = c.estudiante_id AND c.materia_id = $1
                 WHERE e.materia_id = $1
                 ORDER BY e.nombre`,
                [materia_id]
            );

            const excelData = HtmlParser.convertToExcelFormat(students.rows);
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');

            const fileName = `calificaciones_${materiaCheck.rows[0].nombre}_${Date.now()}.xlsx`;
            const filePath = path.join(__dirname, '../uploads', fileName);
            XLSX.writeFile(wb, filePath);

            res.json({
                fileName,
                downloadUrl: `/uploads/${fileName}`
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al exportar a Excel', error: error.message });
        }
    },

    async getCalificacionesAlumno(req, res) {
        try {
            const { materia_id } = req.params;
            
            // Obtener calificaciones del alumno autenticado
            const result = await pool.query(
                `SELECT c.*, m.nombre as materia_nombre, m.clave as materia_clave,
                        p.nombre as profesor_nombre
                 FROM calificaciones c
                 JOIN materias m ON c.materia_id = m.id
                 JOIN usuarios p ON m.profesor_id = p.id
                 WHERE c.estudiante_id = $1 AND c.materia_id = $2
                 ORDER BY m.nombre`,
                [req.usuario.id, materia_id]
            );

            if (result.rows.length === 0) {
                return res.json({
                    materia: null,
                    calificaciones: [],
                    promedio_final: 0,
                    mensaje: 'No hay calificaciones registradas para esta materia'
                });
            }

            const materia = {
                nombre: result.rows[0].materia_nombre,
                clave: result.rows[0].materia_clave,
                profesor: result.rows[0].profesor_nombre
            };

            const calificaciones = result.rows.map(row => ({
                tipo: row.tipo,
                calificacion: row.calificacion,
                calificacion_final: row.calificacion_final,
                porcentaje_final: row.porcentaje_final,
                created_at: row.created_at
            }));

            const promedioFinal = result.rows[0].calificacion_final || 0;

            res.json({
                materia,
                calificaciones,
                promedio_final: promedioFinal,
                mensaje: 'Calificaciones obtenidas exitosamente'
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener calificaciones', error: error.message });
        }
    },

    async getAllCalificacionesAlumno(req, res) {
        try {
            // Obtener todas las calificaciones del alumno autenticado
            const result = await pool.query(
                `SELECT c.*, m.nombre as materia_nombre, m.clave as materia_clave,
                        p.nombre as profesor_nombre
                 FROM calificaciones c
                 JOIN materias m ON c.materia_id = m.id
                 JOIN usuarios p ON m.profesor_id = p.id
                 WHERE c.estudiante_id = $1
                 ORDER BY m.nombre, c.tipo`,
                [req.usuario.id]
            );

            if (result.rows.length === 0) {
                return res.json({
                    materias: [],
                    promedio_general: 0,
                    total_materias: 0,
                    mensaje: 'No hay calificaciones registradas'
                });
            }

            // Agrupar por materia
            const materiasMap = new Map();
            result.rows.forEach(row => {
                if (!materiasMap.has(row.materia_id)) {
                    materiasMap.set(row.materia_id, {
                        materia_id: row.materia_id,
                        nombre: row.materia_nombre,
                        clave: row.materia_clave,
                        profesor: row.profesor_nombre,
                        calificaciones: [],
                        promedio_final: row.calificacion_final || 0
                    });
                }
                
                materiasMap.get(row.materia_id).calificaciones.push({
                    tipo: row.tipo,
                    calificacion: row.calificacion,
                    calificacion_final: row.calificacion_final,
                    porcentaje_final: row.porcentaje_final,
                    created_at: row.created_at
                });
            });

            const materias = Array.from(materiasMap.values());
            const promedioGeneral = materias.reduce((sum, m) => sum + m.promedio_final, 0) / materias.length;

            res.json({
                materias,
                promedio_general: Number(promedioGeneral.toFixed(2)),
                total_materias: materias.length,
                mensaje: 'Calificaciones obtenidas exitosamente'
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener calificaciones', error: error.message });
        }
    },

    async darseDeBajaMateria(req, res) {
        try {
            const { materia_id } = req.params;
            
            // Verificar que el alumno esté inscrito en la materia
            const inscripcionCheck = await pool.query(
                `SELECT e.id, e.nombre 
                 FROM estudiantes e
                 WHERE e.id = $1 AND e.materia_id = $2`,
                [req.usuario.id, materia_id]
            );
            
            if (inscripcionCheck.rows.length === 0) {
                return res.status(404).json({ message: 'No estás inscrito en esta materia' });
            }

            // Eliminar calificaciones del alumno en esta materia
            await pool.query(
                'DELETE FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2',
                [req.usuario.id, materia_id]
            );

            // Eliminar inscripción del alumno
            await pool.query(
                'DELETE FROM estudiantes WHERE id = $1 AND materia_id = $2',
                [req.usuario.id, materia_id]
            );

            res.json({
                message: 'Te has dado de baja correctamente de la materia',
                alumno: inscripcionCheck.rows[0].nombre
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al procesar la solicitud de baja', error: error.message });
        }
    }
};

module.exports = calificacionController;