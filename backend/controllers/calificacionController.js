const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const XLSX = require('xlsx');
const pool = require('../database/connection');
const fileStorage = require('../helpers/fileStorage');

// Configuración de multer para subida de archivos
const multer = require('multer');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'text/html',
        'text/htm',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    const allowedExtensions = ['.htm', '.html', '.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo archivos HTM/HTML o Excel'), false);
    }
};

const upload = multer({ 
    storage: storage, 
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('archivo');

const EXCEL_EXTENSIONS = ['.xlsx', '.xls'];
const HTML_EXTENSIONS = ['.htm', '.html'];
const INFO_COLUMNS = {
    status: 'Status de Inscripción',
    nivel: 'Nivel',
    creditos: 'Créditos'
};
const GRADE_TYPES = [
    { tipo: 'tarea', labels: ['Tareas', 'Tarea'] },
    { tipo: 'examen', labels: ['Exámenes', 'Examenes', 'Examen'] },
    { tipo: 'participacion', labels: ['Participación', 'Participacion'] },
    { tipo: 'proyecto', labels: ['Proyectos', 'Proyecto'] },
    { tipo: 'practica', labels: ['Prácticas', 'Practicas', 'Practica'] }
];

function normalizeKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function normalizePersonName(value) {
    const normalized = normalizeKey(String(value || '').replace(/,/g, ' '));
    return normalized.split(' ').filter(Boolean).sort().join(' ');
}

function samePersonName(left, right) {
    const a = normalizePersonName(left);
    const b = normalizePersonName(right);
    return !!a && !!b && a === b;
}

function isExcelHeaderRow(row) {
    if (!Array.isArray(row)) return false;
    const headers = row.map(normalizeKey).filter(Boolean);
    const hasName = headers.some(header =>
        header === 'nombre completo' ||
        header === 'nombre de alumno' ||
        header === 'alumno' ||
        header === 'estudiante' ||
        header === 'nombre'
    );
    const hasIdentifier = headers.some(header =>
        header === 'id' ||
        header === 'matricula' ||
        header.includes('matricula') ||
        header.includes('correo') ||
        header.includes('email')
    );
    const hasGrade = headers.some(header =>
        header.includes('calificacion') ||
        header.includes('porcentaje') ||
        header.includes('puntos') ||
        header.includes('tarea') ||
        header.includes('examen')
    );
    return (hasName && (hasIdentifier || hasGrade)) || (hasIdentifier && hasGrade);
}

function buildStudentIndexes(alumnos = []) {
    const alumnosPorMatricula = new Map();
    const alumnosPorNombre = new Map();
    const matriculasDuplicadas = new Set();
    const nombresDuplicados = new Set();

    alumnos.forEach((alumno) => {
        const matriculaKey = normalizeKey(alumno.matricula || alumno.ID || alumno.Matricula);
        if (matriculaKey) {
            if (alumnosPorMatricula.has(matriculaKey)) {
                matriculasDuplicadas.add(matriculaKey);
            } else {
                alumnosPorMatricula.set(matriculaKey, alumno);
            }
        }

        const nombreKey = normalizePersonName(alumno.nombre || alumno['Nombre de Alumno'] || alumno.Nombre);
        if (!nombreKey) return;
        if (alumnosPorNombre.has(nombreKey)) {
            nombresDuplicados.add(nombreKey);
        } else {
            alumnosPorNombre.set(nombreKey, alumno);
        }
    });

    return { alumnosPorMatricula, alumnosPorNombre, matriculasDuplicadas, nombresDuplicados };
}

function resolveAlumnoMatch(estudiante, indexes) {
    const matriculaExcel = String(getStudentPayloadValue(estudiante, ['ID', 'Matricula', 'matricula']) || '').trim();
    const nombreExcel = String(getStudentPayloadValue(estudiante, ['Nombre de Alumno', 'Nombre Completo', 'Nombre completo', 'nombre_completo', 'Nombre']) || '').trim();
    const matriculaKey = normalizeKey(matriculaExcel);
    const nombreKey = normalizePersonName(nombreExcel);

    let matchByMatricula = null;
    let matchByNombre = null;
    const errores = [];

    if (matriculaKey) {
        if (indexes.matriculasDuplicadas.has(matriculaKey)) {
            errores.push({
                excel: `${nombreExcel || 'Sin nombre'} (${matriculaExcel})`,
                htm: 'Hay mas de un alumno con esa matricula en el HTM',
                motivo: 'matricula_duplicada'
            });
        } else {
            matchByMatricula = indexes.alumnosPorMatricula.get(matriculaKey) || null;
        }
    }

    if (nombreKey) {
        if (indexes.nombresDuplicados.has(nombreKey)) {
            errores.push({
                excel: `${nombreExcel || 'Sin nombre'}${matriculaExcel ? ` (${matriculaExcel})` : ''}`,
                htm: 'Hay mas de un alumno con ese nombre en el HTM',
                motivo: 'nombre_duplicado'
            });
        } else {
            matchByNombre = indexes.alumnosPorNombre.get(nombreKey) || null;
        }
    }

    if (matchByMatricula && matchByNombre && matchByMatricula.id !== matchByNombre.id) {
        return {
            alumno: null,
            error: {
                excel: `${nombreExcel || 'Sin nombre'} (${matriculaExcel || 'sin matricula'})`,
                htm: `La matricula corresponde a ${matchByMatricula.nombre} (${matchByMatricula.matricula || 'sin matricula'}) y el nombre corresponde a ${matchByNombre.nombre} (${matchByNombre.matricula || 'sin matricula'})`,
                motivo: 'identificadores_en_conflicto'
            }
        };
    }

    if (matchByMatricula || matchByNombre) {
        return { alumno: matchByMatricula || matchByNombre, error: null };
    }

    if (errores.length > 0) {
        return { alumno: null, error: errores[0] };
    }

    if (!matriculaKey && !nombreKey) {
        return {
            alumno: null,
            error: {
                excel: estudiante.Email || 'Fila sin nombre ni matricula',
                htm: 'No se puede comparar con el HTM',
                motivo: 'sin_identificador'
            }
        };
    }

    return {
        alumno: null,
        error: {
            excel: `${nombreExcel || 'Sin nombre'}${matriculaExcel ? ` (${matriculaExcel})` : ''}`,
            htm: 'No existe ese nombre ni esa matricula en la lista HTM procesada',
            motivo: 'sin_coincidencia'
        }
    };
}

function getHtmlCellText($, cell) {
    return $(cell).text().replace(/\s+/g, ' ').trim();
}

function mapHtmlHeaderToField(header) {
    const key = normalizeKey(header);
    if (!key) return '';
    if (key.includes('numero') && key.includes('registro')) return 'registro';
    if (key === 'id' || key.includes('matricula') || key.includes('expediente')) return 'matricula';
    if (key.includes('nombre') || key.includes('alumno') || key.includes('estudiante')) return 'nombre';
    if (key.includes('status') || key.includes('inscripcion')) return 'status';
    if (key.includes('nivel')) return 'nivel';
    if (key.includes('credito')) return 'creditos';
    if (key.includes('correo') || key.includes('email')) return 'email';
    if (key.includes('detalle') && key.includes('calificacion')) return 'detalle';
    if (key.includes('tarea')) return 'tarea';
    if (key.includes('examen')) return 'examen';
    if (key.includes('participacion')) return 'participacion';
    if (key.includes('proyecto')) return 'proyecto';
    if (key.includes('practica')) return 'practica';
    if (key.includes('final') || key.includes('promedio') || key.includes('calificacion')) return 'final';
    return '';
}

function scoreHtmlStudentHeader(fields, rowCount) {
    let score = 0;
    if (fields.includes('nombre')) score += 5;
    if (fields.includes('matricula')) score += 4;
    if (fields.includes('registro')) score += 1;
    if (fields.includes('status')) score += 1;
    if (fields.includes('nivel')) score += 1;
    if (fields.includes('creditos')) score += 1;
    if (rowCount > 2) score += 1;
    return score;
}

function findBestHtmlStudentTable($) {
    let best = null;
    $('table').each((tableIndex, table) => {
        const rows = $(table).find('tr').toArray();
        rows.slice(0, 6).forEach((row, rowIndex) => {
            const headers = $(row).find('th,td').map((_, cell) => getHtmlCellText($, cell)).get();
            const fields = headers.map(mapHtmlHeaderToField);
            const score = scoreHtmlStudentHeader(fields, rows.length);
            if (!best || score > best.score) {
                best = { table, tableIndex, rowIndex, headers, fields, score };
            }
        });
    });
    return best && best.score >= 9 ? best : null;
}

function inferStudentIdentityFromCells(values) {
    let matricula = '';
    let nombre = '';
    for (const value of values) {
        const text = String(value || '').trim();
        if (!text) continue;
        if (!matricula && /^\d{6,15}$/.test(text.replace(/\s+/g, ''))) {
            matricula = text;
            continue;
        }
        if (!nombre && /[a-zA-Z]/.test(text) && !text.includes('@') && !normalizeKey(text).includes('inscrito')) {
            nombre = text;
        }
    }
    return { matricula, nombre };
}

function extractStudentsFromHtml($) {
    const best = findBestHtmlStudentTable($);
    if (!best) return [];

    const indexes = {};
    best.fields.forEach((field, index) => {
        if (field && indexes[field] === undefined) indexes[field] = index;
    });

    const gradeFields = ['tarea', 'examen', 'participacion', 'proyecto', 'practica'];
    const rows = $(best.table).find('tr').toArray().slice(best.rowIndex + 1);
    const estudiantes = [];

    rows.forEach((row, rowIndex) => {
        const cells = $(row).find('td,th').toArray();
        if (cells.length < 2) return;

        const values = cells.map(cell => getHtmlCellText($, cell));
        if (!values.some(Boolean)) return;

        const valueAt = (field) => {
            const index = indexes[field];
            return index === undefined ? '' : String(values[index] || '').trim();
        };

        const inferred = inferStudentIdentityFromCells(values);
        const matricula = valueAt('matricula') || inferred.matricula;
        const nombre = valueAt('nombre') || inferred.nombre;
        if (!matricula && !nombre) return;

        let email = valueAt('email');
        if (!email) {
            const mailto = cells
                .map(cell => $(cell).find('a[href^="mailto:"]').attr('href'))
                .find(Boolean);
            if (mailto) email = mailto.replace(/^mailto:/i, '').trim();
        }

        const estudiante = {
            'Numero de Registro': valueAt('registro') || rowIndex + 1,
            'Nombre de Alumno': nombre,
            Nombre: nombre,
            ID: matricula,
            Matricula: matricula,
            'Status de Inscripcion': valueAt('status'),
            Nivel: valueAt('nivel'),
            Creditos: valueAt('creditos'),
            Email: email,
            Tareas: 0,
            Examenes: 0,
            Participacion: 0,
            Proyectos: 0,
            Practicas: 0
        };

        gradeFields.forEach((field) => {
            const raw = valueAt(field);
            if (raw === '') return;
            const parsed = Number.parseFloat(String(raw).replace('%', '').replace(',', '.'));
            if (Number.isNaN(parsed)) return;
            const normalized = raw.includes('%') ? normalizarCalificacion(parsed) : normalizarCalificacion(parsed);
            if (field === 'tarea') estudiante.Tareas = normalized;
            if (field === 'examen') estudiante.Examenes = normalized;
            if (field === 'participacion') estudiante.Participacion = normalized;
            if (field === 'proyecto') estudiante.Proyectos = normalized;
            if (field === 'practica') estudiante.Practicas = normalized;
        });

        estudiantes.push(estudiante);
    });

    return estudiantes;
}

function getValueByLabels(row, labels) {
    if (!row || typeof row !== 'object') return '';
    const entries = Object.entries(row);
    const normalizedLabels = labels.map(normalizeKey);
    for (const [key, value] of entries) {
        const normalizedKey = normalizeKey(key);
        if (normalizedLabels.some(label => normalizedKey === label || normalizedKey.includes(label))) {
            return value;
        }
    }
    return '';
}

function getStudentPayloadValue(student, labels) {
    for (const label of labels) {
        if (student[label] !== undefined && student[label] !== null && student[label] !== '') {
            return student[label];
        }
    }
    const normalizedLabels = labels.map(normalizeKey);
    for (const [key, value] of Object.entries(student || {})) {
        const normalizedKey = normalizeKey(key);
        if (normalizedLabels.some(label => normalizedKey === label || normalizedKey.includes(label))) {
            return value;
        }
    }
    return '';
}

function getNumericPayloadValue(student, labels) {
    const raw = getStudentPayloadValue(student, labels);
    const num = Number.parseFloat(String(raw ?? '').replace(',', '.'));
    return Number.isNaN(num) ? null : num;
}

function parseGradeFromStudent(student, labels) {
    const value = getStudentPayloadValue(student, labels);
    return normalizarCalificacion(value || 0);
}

function assignGrade(estudiante, tipo, value) {
    const normalized = normalizarCalificacion(value);
    if (tipo === 'tarea') estudiante.Tareas = normalized;
    if (tipo === 'examen') estudiante.Examenes = normalized;
    if (tipo === 'participacion') estudiante.Participacion = normalized;
    if (tipo === 'proyecto') estudiante.Proyectos = normalized;
    if (tipo === 'practica') estudiante.Practicas = normalized;
}

function getDirectGradeValue(row, labels) {
    for (const label of labels) {
        const value = getValueByLabels(row, [label]);
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return value;
        }
    }
    return null;
}

function buildIncomingGrades(estudiante) {
    return GRADE_TYPES.map(({ tipo, labels }) => ({
        tipo,
        calificacion: parseGradeFromStudent(estudiante, labels)
    }));
}

function buildHtmlStudentFingerprint(estudiantes = []) {
    const canonical = estudiantes
        .map(estudiante => {
            const matricula = normalizeKey(getStudentPayloadValue(estudiante, ['ID', 'Matricula', 'Matrícula', 'matricula']));
            const nombre = normalizePersonName(getStudentPayloadValue(estudiante, ['Nombre de Alumno', 'Nombre Completo', 'Nombre', 'nombre']));
            const email = normalizeKey(getStudentPayloadValue(estudiante, ['Email', 'Correo', 'email']));
            return [matricula, nombre, email].join('|');
        })
        .filter(value => value.replace(/\|/g, '').trim())
        .sort()
        .join('\n');

    if (!canonical) return '';
    return crypto.createHash('sha256').update(canonical).digest('hex');
}

function buildNombreCompleto(nombre, apellidos) {
    const nombreLimpio = String(nombre || '').replace(/\s+/g, ' ').trim();
    const apellidosLimpio = String(apellidos || '').replace(/\s+/g, ' ').trim();
    return [nombreLimpio, apellidosLimpio].filter(Boolean).join(' ').trim();
}

function detectArchivoTipo(file) {
    const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
    if (EXCEL_EXTENSIONS.includes(ext)) return 'excel';
    if (HTML_EXTENSIONS.includes(ext)) return 'htm';
    return 'desconocido';
}

async function ensureInfoInscripcionTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS materias_estudiantes (
            id SERIAL PRIMARY KEY,
            materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
            estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
            fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            activo BOOLEAN DEFAULT TRUE,
            UNIQUE(materia_id, estudiante_id)
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS estudiantes_materia_info (
            id SERIAL PRIMARY KEY,
            materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
            estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
            status_inscripcion VARCHAR(100),
            nivel VARCHAR(100),
            creditos VARCHAR(50),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(materia_id, estudiante_id)
        );
    `);
}

async function ensureArchivosCalificacionesExcel() {
    try {
        await pool.query(`ALTER TABLE archivos_calificaciones ADD COLUMN IF NOT EXISTS huella_contenido VARCHAR(128);`);
        await pool.query(`ALTER TABLE archivos_calificaciones DROP CONSTRAINT IF EXISTS archivos_calificaciones_tipo_check;`);
        await pool.query(`
            ALTER TABLE archivos_calificaciones
            ADD CONSTRAINT archivos_calificaciones_tipo_check
            CHECK (tipo IN ('tarea', 'proyecto', 'examen', 'htm', 'excel'))
        `);
    } catch (error) {
        console.log('⚠️ No se pudo actualizar el constraint de archivos_calificaciones:', error.message);
    }
}

async function upsertInfoInscripcion(materiaId, estudianteId, student) {
    const status = getStudentPayloadValue(student, [INFO_COLUMNS.status, 'Status', 'status_inscripcion', 'status']);
    const nivel = getStudentPayloadValue(student, [INFO_COLUMNS.nivel, 'nivel']);
    const creditos = getStudentPayloadValue(student, [INFO_COLUMNS.creditos, 'Creditos', 'creditos']);
    if (status === '' && nivel === '' && creditos === '') return;
    await ensureInfoInscripcionTable();
    await pool.query(`
        INSERT INTO estudiantes_materia_info (materia_id, estudiante_id, status_inscripcion, nivel, creditos, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (materia_id, estudiante_id)
        DO UPDATE SET
            status_inscripcion = COALESCE(NULLIF(EXCLUDED.status_inscripcion, ''), estudiantes_materia_info.status_inscripcion),
            nivel = COALESCE(NULLIF(EXCLUDED.nivel, ''), estudiantes_materia_info.nivel),
            creditos = COALESCE(NULLIF(EXCLUDED.creditos, ''), estudiantes_materia_info.creditos),
            updated_at = NOW()
    `, [materiaId, estudianteId, String(status || ''), String(nivel || ''), String(creditos || '')]);
}

// Helper: obtener estudiantes inscritos en una materia desde TODAS las fuentes
async function getEstudiantesDeMateria(materia_id, includeEmail = false) {
    await ensureInfoInscripcionTable();
    // Verificar qué tablas de inscripción existen
    const tablesCheck = await pool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('inscripciones', 'materias_estudiantes')
    `);
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    const columnsCheck = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'estudiantes'
          AND column_name = 'materia_id'
    `);
    const hasMateriaIdColumn = columnsCheck.rows.length > 0;
    
    const emailCol = includeEmail ? ', e.email' : '';
    let conditions = [];
    
    if (existingTables.includes('materias_estudiantes')) {
        conditions.push(`EXISTS (SELECT 1 FROM materias_estudiantes me WHERE me.estudiante_id = e.id AND me.materia_id = $1 AND me.activo = true)`);
    }
    if (existingTables.includes('inscripciones')) {
        conditions.push(`EXISTS (SELECT 1 FROM inscripciones i WHERE i.estudiante_id = e.id AND i.materia_id = $1)`);
    }
    if (hasMateriaIdColumn) {
        conditions.push(`e.materia_id = $1`);
    }

    if (conditions.length === 0) {
        return [];
    }
    
    const whereClause = conditions.join(' OR ');
    
    const result = await pool.query(`
        SELECT DISTINCT e.id, e.matricula, e.nombre${emailCol},
               emi.status_inscripcion, emi.nivel, emi.creditos
        FROM estudiantes e
        LEFT JOIN estudiantes_materia_info emi
          ON emi.estudiante_id = e.id AND emi.materia_id = $1
        WHERE ${whereClause}
        ORDER BY e.nombre
    `, [materia_id]);
    
    return result.rows;
}

// Función de redondeo personalizada: .5 o menos baja, .6 o más sube
function redondearCalificacion(calificacion) {
    const parteEntera = Math.floor(calificacion);
    const decimal = calificacion - parteEntera;
    
    if (decimal >= 0.6) {
        return parteEntera + 1;
    } else {
        return parteEntera;
    }
}

// Normalizar calificación a escala 0-10
// 100, 10, 1 = 10 (máxima); 80, 8, 0.8 = 8; etc.
function normalizarCalificacion(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return 0;
    if (num > 10) {
        // Escala 0-100 → dividir entre 10
        return Math.min(num / 10, 10);
    } else if (num <= 1 && num > 0) {
        // Escala 0-1 → multiplicar por 10
        return num * 10;
    }
    // Ya está en escala 0-10
    return Math.min(num, 10);
}

const calificacionController = {
    async uploadFile(req, res) {
        console.log('🔍 uploadFile - INICIO COMPLETO');
        console.log('🔍 uploadFile - Headers completos:', JSON.stringify(req.headers, null, 2));
        console.log('🔍 uploadFile - req.file existe:', !!req.file);
        console.log('🔍 uploadFile - req.body existe:', !!req.body);
        console.log('🔍 uploadFile - req.usuario existe:', !!req.usuario);
        
        if (req.file) {
            console.log('🔍 uploadFile - Detalles archivo:', {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                path: req.file.path
            });
        }
        
        if (req.body) {
            console.log('🔍 uploadFile - Body:', JSON.stringify(req.body, null, 2));
        }
        
        try {
            // Manejo de errores de multer
            if (req.file && req.fileValidationError) {
                console.error('❌ Error de validación de archivo:', req.fileValidationError);
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(400).json({ message: req.fileValidationError });
            }
            
            if (!req.file) {
                console.error('❌ ERROR CRÍTICO - No se proporcionó archivo');
                console.error('❌ req.file:', req.file);
                console.error('❌ req.body:', req.body);
                console.error('❌ req.usuario:', req.usuario);
                console.error('❌ Posibles causas:');
                console.error('   - Error en multer ANTES de llegar al controller');
                console.error('   - Content-Type incorrecto');
                console.error('   - Archivo demasiado grande');
                console.error('   - Formato multipart incorrecto');
                return res.status(400).json({ 
                    message: 'Selecciona un archivo antes de continuar.',
                    debug: {
                        hasFile: !!req.file,
                        hasBody: !!req.body,
                        hasUser: !!req.usuario,
                        contentType: req.headers['content-type'],
                        contentLength: req.headers['content-length']
                    }
                });
            }
            
            // Validar que el archivo sea HTM/HTML o Excel
            const allowedMimes = [
                'text/html',
                'text/htm',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel'
            ];
            const allowedExtensions = ['.htm', '.html', '.xlsx', '.xls'];
            const fileExtension = path.extname(req.file.originalname).toLowerCase();
            
            if (!allowedMimes.includes(req.file.mimetype) && !allowedExtensions.includes(fileExtension)) {
                console.error('❌ Tipo de archivo no permitido:', {
                    mimetype: req.file.mimetype,
                    extension: fileExtension,
                    originalname: req.file.originalname
                });
                
                // Eliminar archivo no permitido
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                
                return res.status(400).json({ 
                    message: 'Solo se permiten archivos HTM/HTML o Excel (.xlsx, .xls)',
                    received: {
                        mimetype: req.file.mimetype,
                        extension: fileExtension
                    }
                });
            }
            
            console.log('📡 uploadFile - Archivo recibido (diskStorage):', {
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

            const tipoArchivo = detectArchivoTipo(req.file);
            console.log(`✅ Validaciones de archivo pasadas, procesando ${tipoArchivo}...`);
            if (tipoArchivo === 'excel') {
                const alumnosMateria = await getEstudiantesDeMateria(materiaIdNum, true);
                if (alumnosMateria.length === 0) {
                    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                    return res.status(400).json({
                        message: 'Primero carga y procesa el archivo HTM de la lista de clase para esta materia. Despues sube el Excel para asociar calificaciones.'
                    });
                }
            }
            const resultado = tipoArchivo === 'excel'
                ? await calificacionController.processExcelFile(req.file.path, materiaIdNum, req.usuario.id)
                : await calificacionController.processHtmlFile(req.file.path, materiaIdNum, req.usuario.id);
            
            if (resultado.duplicado) {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    message: resultado.message || 'Ya existe un archivo con la misma información para esta materia.',
                    duplicado: true
                });
            }

            if (tipoArchivo === 'excel' && resultado.procesados === 0 && resultado.noEncontrados?.length) {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    message: 'El Excel no coincide con la lista HTM procesada. Cada fila debe coincidir por nombre o por matricula.',
                    noEncontrados: resultado.noEncontrados.slice(0, 20)
                });
            }

            // Guardar archivo en PostgreSQL para persistencia
            await fileStorage.guardarArchivo(req.file);

            // Registrar en archivos_calificaciones
            try {
                await ensureArchivosCalificacionesExcel();
                await pool.query(
                    `INSERT INTO archivos_calificaciones (profesor_id, materia_id, nombre_archivo, tipo, estado, detalles, huella_contenido)
                     VALUES ($1, $2, $3, $4, 'Procesado', $5, $6)`,
                    [req.usuario.id, materiaIdNum, req.file.filename, tipoArchivo === 'excel' ? 'excel' : 'htm',
                     `Estudiantes procesados: ${resultado.procesados}, Nuevos: ${resultado.nuevos}, Actualizados: ${resultado.actualizados}${resultado.noEncontrados?.length ? `, No encontrados en HTM: ${resultado.noEncontrados.length}` : ''}`,
                     resultado.fingerprint || null]
                );
            } catch (regErr) {
                console.log('⚠️ No se pudo registrar en archivos_calificaciones:', regErr.message);
            }
            
            console.log('✅ Archivo procesado exitosamente:', resultado);
            
            res.json({
                message: 'Archivo procesado correctamente',
                resultado,
                fileName: req.file.filename,
                archivo: {
                    detalles: `Estudiantes procesados: ${resultado.procesados}, Nuevos: ${resultado.nuevos}, Actualizados: ${resultado.actualizados}${resultado.noEncontrados?.length ? `, No encontrados en HTM: ${resultado.noEncontrados.length}` : ''}`
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
    },

    async procesarDatosDirectos(req, res) {
        try {
            console.log('📡 procesarDatosDirectos - Procesando datos directos desde frontend');
            console.log('📡 procesarDatosDirectos - Body recibido:', req.body);
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para procesar datos' });
            }
            
            const { materia_id, estudiantes, archivo_original } = req.body;
            
            if (!materia_id || !estudiantes) {
                return res.status(400).json({ 
                    message: 'Faltan parámetros requeridos',
                    required: ['materia_id', 'estudiantes'],
                    received: { materia_id, estudiantes: !!estudiantes }
                });
            }
            
            // Validar que materia_id sea un número válido
            const materiaIdNum = parseInt(materia_id);
            if (isNaN(materiaIdNum) || materiaIdNum <= 0) {
                return res.status(400).json({ 
                    message: 'Materia ID inválido',
                    received: { materia_id }
                });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1 AND profesor_id = $2',
                [materiaIdNum, req.usuario.id]
            );
            
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            console.log('✅ Materia verificada:', materiaCheck.rows[0].nombre);
            console.log(`📊 Procesando ${estudiantes.length} estudiantes desde datos directos...`);
            
            let procesados = 0;
            let nuevos = 0;
            let actualizados = 0;
            
            // Obtener ponderaciones de la materia para aplicarlas
            const ponderacionesQuery = await pool.query(
                'SELECT tipo, peso FROM ponderaciones WHERE materia_id = $1',
                [materiaIdNum]
            );
            
            const ponderaciones = {};
            if (ponderacionesQuery.rows.length > 0) {
                ponderacionesQuery.rows.forEach(row => {
                    ponderaciones[row.tipo] = row.peso;
                });
            } else {
                // Usar ponderaciones por defecto si no hay guardadas
                ponderaciones.tarea = 20;
                ponderaciones.examen = 30;
                ponderaciones.participacion = 10;
                ponderaciones.proyecto = 20;
                ponderaciones.practica = 20;
                console.log('⚠️ Sin ponderaciones guardadas, usando valores por defecto');
            }
            
            console.log('📊 Ponderaciones para materia:', ponderaciones);
            
            await ensureInfoInscripcionTable();

            // Procesar cada estudiante
            for (const estudiante of estudiantes) {
                try {
                    console.log(`🔄 Procesando estudiante: ${estudiante['Nombre de Alumno']} (${estudiante.ID})`);
                    
                    const matricula = String(getStudentPayloadValue(estudiante, ['ID', 'Matrícula', 'Matricula', 'matricula']) || `AUTO_${Date.now()}_${procesados}`).trim();
                    const nombre = String(getStudentPayloadValue(estudiante, ['Nombre de Alumno', 'Nombre Completo', 'Nombre', 'nombre']) || 'Sin nombre').trim();
                    const email = String(getStudentPayloadValue(estudiante, ['Email', 'Correo', 'email']) || '').trim();

                    // Buscar si el estudiante ya existe
                    const existingEstudiante = await pool.query(
                        'SELECT id FROM estudiantes WHERE matricula = $1',
                        [matricula]
                    );
                    
                    let estudianteId;
                    if (existingEstudiante.rows.length > 0) {
                        estudianteId = existingEstudiante.rows[0].id;
                        actualizados++;
                        
                        // Verificar si ya está asociado a la materia
                        const materiaEstudianteCheck = await pool.query(
                            'SELECT id FROM materias_estudiantes WHERE materia_id = $1 AND estudiante_id = $2',
                            [materiaIdNum, estudianteId]
                        );
                        
                        if (materiaEstudianteCheck.rows.length === 0) {
                            // Asociar estudiante existente a la materia
                            await pool.query(
                                'INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion, activo) VALUES ($1, $2, NOW(), true)',
                                [materiaIdNum, estudianteId]
                            );
                            console.log(`✅ Estudiante existente ${estudiante['Nombre de Alumno']} asociado a materia`);
                        } else {
                            console.log(`ℹ️ Estudiante existente ${estudiante['Nombre de Alumno']} ya estaba asociado a materia`);
                        }
                    } else {
                        // Crear nuevo estudiante
                        const newEstudiante = await pool.query(
                            `INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
                            [matricula, nombre, email || '', 'temporal123', 'alumno', true]
                        );
                        estudianteId = newEstudiante.rows[0].id;
                        nuevos++;
                        
                        // Asociar estudiante a la materia
                        await pool.query(
                            'INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion, activo) VALUES ($1, $2, NOW(), true)',
                            [materiaIdNum, estudianteId]
                        );
                        console.log(`✅ Nuevo estudiante ${estudiante['Nombre de Alumno']} creado y asociado a materia`);
                    }
                    
                    // Guardar calificaciones aplicando ponderaciones y normalización
                    await upsertInfoInscripcion(materiaIdNum, estudianteId, estudiante);

                    const calificaciones = [
                        { tipo: 'tarea', calificacion: parseGradeFromStudent(estudiante, ['Tareas', 'Tarea']) },
                        { tipo: 'examen', calificacion: normalizarCalificacion(estudiante['Exámenes'] || estudiante.Examenes || 0) },
                        { tipo: 'participacion', calificacion: normalizarCalificacion(estudiante['Participación'] || estudiante.Participacion || 0) },
                        { tipo: 'proyecto', calificacion: parseGradeFromStudent(estudiante, ['Proyectos', 'Proyecto']) },
                        { tipo: 'practica', calificacion: normalizarCalificacion(estudiante['Prácticas'] || estudiante.Practicas || 0) }
                    ];
                    
                    let calificacionFinal = 0;
                    let totalPeso = 0;
                    
                    for (const cal of calificaciones) {
                        await pool.query(`
                            INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                            VALUES ($1, $2, $3, $4, NOW())
                            ON CONFLICT (estudiante_id, materia_id, tipo) 
                            DO UPDATE SET calificacion = EXCLUDED.calificacion
                        `, [estudianteId, materiaIdNum, cal.tipo, cal.calificacion]);
                        
                        const peso = ponderaciones[cal.tipo] || 0;
                        if (peso > 0) {
                            calificacionFinal += (cal.calificacion * peso) / 100;
                            totalPeso += peso;
                        }
                        
                        console.log(`✅ Calificación guardada: ${estudiante['Nombre de Alumno']} - ${cal.tipo}: ${cal.calificacion} (peso: ${peso}%)`);
                    }
                    
                    // Calcular y guardar calificación final (sin redondeo) y calificación redondeada
                    if (totalPeso > 0) {
                        if (totalPeso !== 100) {
                            calificacionFinal = (calificacionFinal * 100) / totalPeso;
                        }
                        
                        // Guardar calificación final SIN redondeo (promedio ponderado exacto)
                        const calFinalSinRedondeo = parseFloat(calificacionFinal.toFixed(2));
                        await pool.query(`
                            INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                            VALUES ($1, $2, 'final_sin_redondeo', $3, NOW())
                            ON CONFLICT (estudiante_id, materia_id, tipo) 
                            DO UPDATE SET calificacion = EXCLUDED.calificacion
                        `, [estudianteId, materiaIdNum, calFinalSinRedondeo]);
                        
                        // Guardar calificación CON redondeo (.5 baja, .6 sube)
                        const calFinalRedondeada = redondearCalificacion(calificacionFinal);
                        await pool.query(`
                            INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                            VALUES ($1, $2, 'final', $3, NOW())
                            ON CONFLICT (estudiante_id, materia_id, tipo) 
                            DO UPDATE SET calificacion = EXCLUDED.calificacion
                        `, [estudianteId, materiaIdNum, calFinalRedondeada]);
                        
                        console.log(`✅ Calificación: ${estudiante['Nombre de Alumno']} - Sin redondeo: ${calFinalSinRedondeo}, Redondeada: ${calFinalRedondeada}`);
                    }
                    
                    procesados++;
                    
                } catch (error) {
                    console.error(`❌ Error procesando estudiante ${estudiante.ID}:`, error.message);
                }
            }
            
            const resultado = {
                procesados,
                nuevos,
                actualizados,
                estudiantes
            };
            
            console.log('✅ Datos procesados exitosamente:', resultado);
            
            res.json({
                message: 'Datos procesados correctamente',
                resultado,
                fileName: archivo_original,
                archivo: {
                    detalles: `Estudiantes procesados: ${resultado.procesados}, Nuevos: ${resultado.nuevos}, Actualizados: ${resultado.actualizados}`
                }
            });
            
        } catch (error) {
            console.error('❌ Error en procesarDatosDirectos:', error);
            res.status(500).json({ 
                message: 'Error al procesar los datos', 
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
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
                     SET calificacion = $1
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
            
            // Recalcular calificación final automáticamente
            const ponderacionesQuery = await pool.query(
                'SELECT tipo, peso FROM ponderaciones WHERE materia_id = $1',
                [materiaIdNum]
            );
            
            {
                const ponderacionesMap = {};
                if (ponderacionesQuery.rows.length > 0) {
                    ponderacionesQuery.rows.forEach(row => {
                        ponderacionesMap[row.tipo] = parseFloat(row.peso);
                    });
                } else {
                    ponderacionesMap.tarea = 20;
                    ponderacionesMap.examen = 30;
                    ponderacionesMap.participacion = 10;
                    ponderacionesMap.proyecto = 20;
                    ponderacionesMap.practica = 20;
                }
                
                const calificacionesQuery = await pool.query(
                    `SELECT tipo, calificacion FROM calificaciones 
                     WHERE estudiante_id = $1 AND materia_id = $2 AND tipo NOT IN ('final', 'final_sin_redondeo')`,
                    [estudianteIdNum, materiaIdNum]
                );
                
                let calificacionFinal = 0;
                let totalPeso = 0;
                
                calificacionesQuery.rows.forEach(cal => {
                    const peso = ponderacionesMap[cal.tipo] || 0;
                    if (peso > 0) {
                        calificacionFinal += (normalizarCalificacion(cal.calificacion) * peso) / 100;
                        totalPeso += peso;
                    }
                });
                
                if (totalPeso > 0 && totalPeso !== 100) {
                    calificacionFinal = (calificacionFinal * 100) / totalPeso;
                }
                
                // Guardar calificación sin redondeo
                const calFinalSinRedondeo = parseFloat(calificacionFinal.toFixed(2));
                await pool.query(
                    `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                     VALUES ($1, $2, 'final_sin_redondeo', $3, NOW())
                     ON CONFLICT (estudiante_id, materia_id, tipo) 
                     DO UPDATE SET calificacion = EXCLUDED.calificacion`,
                    [estudianteIdNum, materiaIdNum, calFinalSinRedondeo]
                );
                
                // Guardar calificación redondeada
                const calFinalRedondeada = redondearCalificacion(calificacionFinal);
                await pool.query(
                    `INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                     VALUES ($1, $2, 'final', $3, NOW())
                     ON CONFLICT (estudiante_id, materia_id, tipo) 
                     DO UPDATE SET calificacion = EXCLUDED.calificacion`,
                    [estudianteIdNum, materiaIdNum, calFinalRedondeada]
                );
                
                console.log(`📊 Calificación recalculada: sin redondeo=${calFinalSinRedondeo}, redondeada=${calFinalRedondeada}`);
            }
            
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
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            let query, params;
            if (req.usuario.rol === 'administrador') {
                query = `SELECT a.*, m.nombre AS materia_nombre, u.nombre AS profesor_nombre
                         FROM archivos_calificaciones a
                         JOIN materias m ON a.materia_id = m.id
                         JOIN usuarios u ON a.profesor_id = u.id
                         ORDER BY a.fecha_subida DESC`;
                params = [];
            } else {
                query = `SELECT a.*, m.nombre AS materia_nombre
                         FROM archivos_calificaciones a
                         JOIN materias m ON a.materia_id = m.id
                         WHERE a.profesor_id = $1
                         ORDER BY a.fecha_subida DESC`;
                params = [req.usuario.id];
            }
            const result = await pool.query(query, params);
            res.json(result.rows);

        } catch (error) {
            console.error('❌ Error en getArchivos:', error);
            res.status(500).json({ message: 'Error al obtener archivos', error: error.message });
        }
    },

    async descargarArchivoCalificacion(req, res) {
        try {
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { id } = req.params;
            const find = await pool.query(
                'SELECT nombre_archivo FROM archivos_calificaciones WHERE id = $1',
                [id]
            );
            if (find.rowCount === 0 || !find.rows[0].nombre_archivo) {
                return res.status(404).json({ message: 'Archivo no encontrado' });
            }
            return fileStorage.enviarArchivo(res, find.rows[0].nombre_archivo);

        } catch (error) {
            console.error('❌ Error en descargarArchivoCalificacion:', error);
            res.status(500).json({ message: 'Error al descargar archivo', error: error.message });
        }
    },

    async deleteArchivo(req, res) {
        try {
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para acceder a esta función' });
            }

            const { id } = req.params;
            const result = await pool.query(
                'DELETE FROM archivos_calificaciones WHERE id = $1 RETURNING nombre_archivo',
                [id]
            );
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Archivo no encontrado' });
            }
            const fileName = result.rows[0].nombre_archivo;
            await fileStorage.eliminarArchivo(fileName);
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

            // Obtener alumnos de la materia desde todas las fuentes de inscripción
            const alumnosRows = await getEstudiantesDeMateria(materia_id, true);
            
            // Obtener ponderaciones de la materia
            const ponderacionesQuery = await pool.query(
                'SELECT tipo, peso FROM ponderaciones WHERE materia_id = $1',
                [materia_id]
            );
            
            const ponderacionesMap = {};
            if (ponderacionesQuery.rows.length > 0) {
                ponderacionesQuery.rows.forEach(row => {
                    ponderacionesMap[row.tipo] = parseFloat(row.peso);
                });
            } else {
                ponderacionesMap.tarea = 20;
                ponderacionesMap.examen = 30;
                ponderacionesMap.participacion = 10;
                ponderacionesMap.proyecto = 20;
                ponderacionesMap.practica = 20;
            }

            // Obtener calificaciones para cada alumno
            const alumnosConCalificaciones = await Promise.all(
                alumnosRows.map(async (alumno) => {
                    const calificacionesQuery = await pool.query(`
                        SELECT tipo, calificacion, fecha_registro
                        FROM calificaciones 
                        WHERE estudiante_id = $1 AND materia_id = $2
                        ORDER BY tipo
                    `, [alumno.id, materia_id]);
                    
                    const calificaciones = calificacionesQuery.rows;
                    
                    // Construir objeto con todas las calificaciones - mapeo de tipos a nombres de campos
                    const calificacionesObj = {};
                    calificaciones.forEach(c => {
                        switch(c.tipo) {
                            case 'tarea':
                                calificacionesObj.tarea = parseFloat(c.calificacion);
                                break;
                            case 'examen':
                                calificacionesObj.examen = parseFloat(c.calificacion);
                                break;
                            case 'participacion':
                                calificacionesObj.participacion = parseFloat(c.calificacion);
                                break;
                            case 'proyecto':
                                calificacionesObj.proyecto = parseFloat(c.calificacion);
                                break;
                            case 'practica':
                                calificacionesObj.practica = parseFloat(c.calificacion);
                                break;
                            case 'final':
                                calificacionesObj.calificacion_redondeada = parseFloat(c.calificacion);
                                break;
                            case 'final_sin_redondeo':
                                calificacionesObj.calificacion_final = parseFloat(c.calificacion);
                                break;
                            default:
                                calificacionesObj[c.tipo] = parseFloat(c.calificacion);
                        }
                    });
                    
                    // Si no hay calificación final, calcular promedio ponderado con ponderaciones
                    if (calificacionesObj.calificacion_final == null) {
                        let calFinal = 0;
                        let totalPeso = 0;
                        const tipos = ['tarea', 'examen', 'participacion', 'proyecto', 'practica'];
                        tipos.forEach(tipo => {
                            const peso = ponderacionesMap[tipo] || 0;
                            const valor = calificacionesObj[tipo] || 0;
                            if (peso > 0) {
                                calFinal += (valor * peso) / 100;
                                totalPeso += peso;
                            }
                        });
                        if (totalPeso > 0 && totalPeso !== 100) {
                            calFinal = (calFinal * 100) / totalPeso;
                        }
                        calificacionesObj.calificacion_final = parseFloat(calFinal.toFixed(2));
                    }
                    
                    // Si no hay calificación redondeada, calcular desde final
                    if (calificacionesObj.calificacion_redondeada == null) {
                        calificacionesObj.calificacion_redondeada = redondearCalificacion(calificacionesObj.calificacion_final);
                    }
                    
                    return {
                        ...alumno,
                        status: alumno.status_inscripcion || '',
                        nivel: alumno.nivel || '',
                        creditos: alumno.creditos || '',
                        'Status de Inscripción': alumno.status_inscripcion || '',
                        'Nivel': alumno.nivel || '',
                        'Créditos': alumno.creditos || '',
                        ...calificacionesObj,
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
            const materiaIdFinal = materia_id || req.query?.materia_id;
            console.log('📡 createAlumno - Datos extraídos:', { matricula, nombre, email, materia_id: materiaIdFinal });
            
            if (!matricula || !nombre) {
                return res.status(400).json({ 
                    message: 'Matrícula y nombre son obligatorios',
                    required: ['matricula', 'nombre'],
                    received: { matricula, nombre }
                });
            }

            // Verificar si la matrícula ya existe
            const matriculaCheck = await pool.query(
                'SELECT id, nombre, email FROM estudiantes WHERE matricula = $1',
                [matricula.trim()]
            );
            
            let alumnoExistente = null;
            
            if (matriculaCheck.rows.length > 0) {
                alumnoExistente = matriculaCheck.rows[0];
                console.log('📡 Alumno existente encontrado:', alumnoExistente);
                
                // Verificar si ya está inscrito en esta materia
                if (materiaIdFinal) {
                    const materiaCheck = await pool.query(
                        'SELECT id FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2',
                        [alumnoExistente.id, materiaIdFinal]
                    );
                    
                    if (materiaCheck.rows.length > 0) {
                        console.log('❌ Alumno ya está inscrito en esta materia');
                        
                        // Obtener información de la materia para mostrar mensaje más claro
                        const materiaInfo = await pool.query(
                            'SELECT nombre FROM materias WHERE id = $1',
                            [materiaIdFinal]
                        );
                        
                        const materiaNombre = materiaInfo.rows[0]?.nombre || 'esta materia';
                        
                        return res.status(400).json({ 
                            message: `El alumno ya está inscrito en ${materiaNombre}`,
                            alumno: alumnoExistente,
                            materia_id: materiaIdFinal,
                            materia_nombre: materiaNombre,
                            ya_inscrito: true
                        });
                    }
                }
                
                // Actualizar datos si es necesario
                if (alumnoExistente.nombre !== nombre.trim() || alumnoExistente.email !== (email?.trim() || null)) {
                    await pool.query(
                        'UPDATE estudiantes SET nombre = $1, email = $2 WHERE id = $3',
                        [nombre.trim(), email?.trim() || null, alumnoExistente.id]
                    );
                    console.log('✅ Datos del alumno actualizados');
                }
            } else {
                // Crear nuevo alumno
                const result = await pool.query(
                    `INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, matricula, nombre, email, created_at`,
                    [matricula.trim(), nombre.trim(), email?.trim() || null, 'temporal123', 'alumno', true]
                );
                
                alumnoExistente = result.rows[0];
                console.log('✅ Alumno creado:', alumnoExistente);
            }

            // Asociar el alumno a la materia seleccionada en el módulo de calificaciones.
            if (materiaIdFinal) {
                console.log('📡 Asociando alumno a materia:', materiaIdFinal);
                await pool.query(
                    `INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion, activo)
                     VALUES ($1, $2, NOW(), true)
                     ON CONFLICT (materia_id, estudiante_id) DO UPDATE SET activo = true`,
                    [materiaIdFinal, alumnoExistente.id]
                );
                console.log('✅ Alumno asociado a materia');
            }

            res.status(201).json(alumnoExistente);
            
        } catch (error) {
            console.error('❌ Error en createAlumno:', error);
            res.status(500).json({ message: 'Error al crear alumno', error: error.message });
        }
    },

    async deleteAlumno(req, res) {
        try {
            console.log('📡 deleteAlumno - Eliminando alumno');
            
            const { id } = req.params;
            const materia_id = req.query.materia_id;
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar alumnos' });
            }
            
            // Verificar que el alumno exista
            const alumnoCheck = await pool.query(
                'SELECT id, nombre FROM estudiantes WHERE id = $1',
                [id]
            );
            
            if (alumnoCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Alumno no encontrado' });
            }
            
            // Verificar qué tablas de inscripción existen
            const tablesCheck = await pool.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('inscripciones', 'materias_estudiantes')
            `);
            const existingTables = tablesCheck.rows.map(r => r.table_name);
            
            if (materia_id) {
                // Eliminar de la materia específica
                await pool.query('DELETE FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2', [id, materia_id]);
                
                if (existingTables.includes('materias_estudiantes')) {
                    await pool.query('DELETE FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2', [id, materia_id]);
                }
                if (existingTables.includes('inscripciones')) {
                    await pool.query('DELETE FROM inscripciones WHERE estudiante_id = $1 AND materia_id = $2', [id, materia_id]);
                }
                await pool.query('UPDATE estudiantes SET materia_id = NULL WHERE id = $1 AND materia_id = $2', [id, materia_id]);
            } else {
                // Sin materia_id, eliminar de todas las materias
                await pool.query('DELETE FROM calificaciones WHERE estudiante_id = $1', [id]);
                
                if (existingTables.includes('materias_estudiantes')) {
                    await pool.query('DELETE FROM materias_estudiantes WHERE estudiante_id = $1', [id]);
                }
                if (existingTables.includes('inscripciones')) {
                    await pool.query('DELETE FROM inscripciones WHERE estudiante_id = $1', [id]);
                }
                await pool.query('UPDATE estudiantes SET materia_id = NULL WHERE id = $1', [id]);
            }
            
            console.log(`✅ Alumno eliminado: ${alumnoCheck.rows[0].nombre}${materia_id ? ' de materia ' + materia_id : ''}`);
            
            res.json({ 
                message: 'Alumno eliminado correctamente',
                alumno: alumnoCheck.rows[0]
            });
            
        } catch (error) {
            console.error('❌ Error en deleteAlumno:', error);
            res.status(500).json({ message: 'Error al eliminar alumno', error: error.message });
        }
    },

    async deleteAllAlumnos(req, res) {
        try {
            console.log('📡 deleteAllAlumnos - Eliminando todos los alumnos de una materia');
            
            const { materia_id } = req.params;
            
            // Verificar que el usuario exista y tenga permisos
            if (!req.usuario || !['profesor', 'administrador'].includes(req.usuario.rol)) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar alumnos' });
            }
            
            // Validar materia_id
            const materiaIdNum = parseInt(materia_id);
            if (isNaN(materiaIdNum) || materiaIdNum <= 0) {
                return res.status(400).json({ message: 'ID de materia inválido' });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1 AND profesor_id = $2',
                [materiaIdNum, req.usuario.id]
            );
            
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            // Contar alumnos antes de eliminar
            const alumnosRows = await getEstudiantesDeMateria(materiaIdNum);
            const totalAlumnos = alumnosRows.length;
            
            if (totalAlumnos === 0) {
                return res.status(400).json({ message: 'No hay alumnos inscritos en esta materia' });
            }
            
            // Verificar qué tablas de inscripción existen
            const tablesCheck = await pool.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('inscripciones', 'materias_estudiantes')
            `);
            const existingTables = tablesCheck.rows.map(r => r.table_name);
            
            // Eliminar calificaciones de la materia
            await pool.query('DELETE FROM calificaciones WHERE materia_id = $1', [materiaIdNum]);
            
            // Eliminar de todas las tablas de inscripción
            if (existingTables.includes('materias_estudiantes')) {
                await pool.query('DELETE FROM materias_estudiantes WHERE materia_id = $1', [materiaIdNum]);
            }
            if (existingTables.includes('inscripciones')) {
                await pool.query('DELETE FROM inscripciones WHERE materia_id = $1', [materiaIdNum]);
            }
            await pool.query('UPDATE estudiantes SET materia_id = NULL WHERE materia_id = $1', [materiaIdNum]);
            
            console.log(`✅ Eliminados ${totalAlumnos} alumnos de la materia ${materiaCheck.rows[0].nombre}`);
            
            res.json({ 
                message: 'Todos los alumnos eliminados correctamente',
                materia: materiaCheck.rows[0],
                total_eliminados: totalAlumnos
            });
            
        } catch (error) {
            console.error('❌ Error en deleteAllAlumnos:', error);
            res.status(500).json({ message: 'Error al eliminar todos los alumnos', error: error.message });
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

            const materia_id = parseInt(req.body.materia_id);
            
            if (!materia_id || isNaN(materia_id)) {
                return res.status(400).json({ message: 'materia_id es requerido y debe ser un número válido' });
            }
            
            // Aceptar ponderaciones como objeto anidado O como campos planos en el body
            let ponderaciones = req.body.ponderaciones;
            if (!ponderaciones) {
                const { tarea, tareas, examen, examenes, participacion, proyecto, proyectos, practica, practicas } = req.body;
                if (tarea !== undefined || tareas !== undefined || examen !== undefined || examenes !== undefined || participacion !== undefined) {
                    ponderaciones = {
                        tarea: parseFloat(tarea || tareas) || 0,
                        examen: parseFloat(examen || examenes) || 0,
                        participacion: parseFloat(participacion) || 0,
                        proyecto: parseFloat(proyecto || proyectos) || 0,
                        practica: parseFloat(practica || practicas) || 0
                    };
                }
            } else {
                const normalized = {};
                for (const [key, value] of Object.entries(ponderaciones)) {
                    const normalizedKey = key === 'tareas' ? 'tarea' : key === 'examenes' ? 'examen' : key === 'proyectos' ? 'proyecto' : key === 'practicas' ? 'practica' : key;
                    normalized[normalizedKey] = parseFloat(value) || 0;
                }
                ponderaciones = normalized;
            }
            
            if (!ponderaciones) {
                return res.status(400).json({ message: 'Faltan ponderaciones' });
            }

            // Verificar que la materia exista
            const materiaCheck = await pool.query('SELECT id FROM materias WHERE id = $1', [materia_id]);
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }

            // Eliminar ponderaciones existentes e insertar nuevas
            await pool.query('DELETE FROM ponderaciones WHERE materia_id = $1', [materia_id]);

            const ponderacionesArray = Object.entries(ponderaciones).map(([tipo, peso]) => ({
                materia_id,
                tipo,
                peso: parseFloat(peso)
            }));

            for (const ponderacion of ponderacionesArray) {
                await pool.query(
                    'INSERT INTO ponderaciones (materia_id, tipo, peso) VALUES ($1, $2, $3)',
                    [ponderacion.materia_id, ponderacion.tipo, ponderacion.peso]
                );
            }

            console.log('✅ Ponderaciones guardadas:', ponderacionesArray);
            
            // Recalcular calificaciones finales para alumnos existentes
            let alumnosRecalculados = 0;
            try {
                const alumnosRows = await getEstudiantesDeMateria(materia_id);
                console.log(`📊 Encontrados ${alumnosRows.length} alumnos en materia ${materia_id}`);
                
                for (const alumno of alumnosRows) {
                    try {
                        // Obtener calificaciones parciales del alumno
                        const calificacionesQuery = await pool.query(`
                            SELECT tipo, calificacion
                            FROM calificaciones 
                            WHERE estudiante_id = $1 AND materia_id = $2 AND tipo NOT IN ('final', 'final_sin_redondeo')
                        `, [alumno.id, materia_id]);
                        
                        let calificacionFinal = 0;
                        let totalPeso = 0;
                        
                        if (calificacionesQuery.rows.length > 0) {
                            calificacionesQuery.rows.forEach(cal => {
                                const peso = ponderaciones[cal.tipo] || 0;
                                if (peso > 0) {
                                    calificacionFinal += (normalizarCalificacion(cal.calificacion) * peso) / 100;
                                    totalPeso += peso;
                                }
                            });
                        }
                        
                        if (totalPeso > 0 && totalPeso !== 100) {
                            calificacionFinal = (calificacionFinal * 100) / totalPeso;
                        }
                        
                        const calSinRedondeo = parseFloat(calificacionFinal.toFixed(2));
                        const calRedondeada = redondearCalificacion(calificacionFinal);
                        
                        await pool.query(`
                            INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                            VALUES ($1, $2, 'final_sin_redondeo', $3, NOW())
                            ON CONFLICT (estudiante_id, materia_id, tipo) 
                            DO UPDATE SET calificacion = EXCLUDED.calificacion
                        `, [alumno.id, materia_id, calSinRedondeo]);
                        
                        await pool.query(`
                            INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                            VALUES ($1, $2, 'final', $3, NOW())
                            ON CONFLICT (estudiante_id, materia_id, tipo) 
                            DO UPDATE SET calificacion = EXCLUDED.calificacion
                        `, [alumno.id, materia_id, calRedondeada]);
                        
                        alumnosRecalculados++;
                        console.log(`✅ ${alumno.nombre}: sin redondeo=${calSinRedondeo}, redondeada=${calRedondeada}`);
                    } catch (alumnoError) {
                        console.error(`❌ Error recalculando para ${alumno.nombre}:`, alumnoError.message);
                    }
                }
            } catch (recalcError) {
                console.error('⚠️ Error en recálculo (ponderaciones sí se guardaron):', recalcError.message);
            }
            
            res.json({ 
                message: 'Ponderaciones guardadas y aplicadas correctamente',
                ponderaciones: ponderacionesArray,
                alumnos_actualizados: alumnosRecalculados
            });
            
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
            
            // Obtener ponderaciones de la base de datos
            const ponderacionesQuery = await pool.query(
                'SELECT tipo, peso FROM ponderaciones WHERE materia_id = $1',
                [materia_id]
            );

            // Si no hay ponderaciones guardadas, retornar valores por defecto
            if (ponderacionesQuery.rows.length === 0) {
                const defaultPonderaciones = {
                    tarea: 20,
                    examen: 30,
                    participacion: 10,
                    proyecto: 20,
                    practica: 20
                };
                console.log('📡 getPonderaciones - Usando ponderaciones por defecto');
                return res.json(defaultPonderaciones);
            }

            // Convertir a objeto
            const ponderaciones = {};
            ponderacionesQuery.rows.forEach(row => {
                ponderaciones[row.tipo] = parseFloat(row.peso);
            });

            console.log('✅ Ponderaciones obtenidas:', ponderaciones);
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
            const materiaIdNum = parseInt(materia_id);
            
            if (isNaN(materiaIdNum) || materiaIdNum <= 0) {
                return res.status(400).json({ message: 'Materia ID inválido' });
            }
            
            // Verificar que la materia exista y pertenezca al profesor
            const materiaCheck = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1 AND profesor_id = $2',
                [materiaIdNum, req.usuario.id]
            );
            
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada o no tienes permisos' });
            }
            
            console.log('✅ Materia verificada:', materiaCheck.rows[0].nombre);
            
            // Obtener ponderaciones de la materia
            const ponderacionesQuery = await pool.query(
                'SELECT tipo, peso FROM ponderaciones WHERE materia_id = $1',
                [materiaIdNum]
            );
            
            const ponderaciones = {};
            if (ponderacionesQuery.rows.length > 0) {
                ponderacionesQuery.rows.forEach(row => {
                    ponderaciones[row.tipo] = row.peso;
                });
            } else {
                // Usar ponderaciones por defecto
                ponderaciones.tarea = 20;
                ponderaciones.examen = 30;
                ponderaciones.participacion = 10;
                ponderaciones.proyecto = 20;
                ponderaciones.practica = 20;
                console.log('⚠️ Sin ponderaciones guardadas, usando valores por defecto');
            }
            
            console.log('📊 Ponderaciones para cálculo:', ponderaciones);
            
            // Obtener todos los estudiantes de la materia desde todas las fuentes
            const estudiantesRows = await getEstudiantesDeMateria(materiaIdNum);
            
            if (estudiantesRows.length === 0) {
                return res.json({ message: 'No hay alumnos inscritos en esta materia', calculados: 0 });
            }
            
            console.log(`📊 Procesando ${estudiantesRows.length} estudiantes...`);
            
            let calculados = 0;
            
            // Procesar cada estudiante
            for (const estudiante of estudiantesRows) {
                try {
                    // Obtener calificaciones del estudiante
                    const calificacionesQuery = await pool.query(`
                        SELECT tipo, calificacion
                        FROM calificaciones 
                        WHERE estudiante_id = $1 AND materia_id = $2 AND tipo NOT IN ('final', 'final_sin_redondeo')
                    `, [estudiante.id, materiaIdNum]);
                    
                    let calificacionFinal = 0;
                    let totalPeso = 0;
                    
                    if (calificacionesQuery.rows.length > 0) {
                        calificacionesQuery.rows.forEach(cal => {
                            const peso = ponderaciones[cal.tipo] || 0;
                            if (peso > 0) {
                                calificacionFinal += (normalizarCalificacion(cal.calificacion) * peso) / 100;
                                totalPeso += peso;
                            }
                        });
                        
                        if (totalPeso > 0 && totalPeso !== 100) {
                            calificacionFinal = (calificacionFinal * 100) / totalPeso;
                        }
                    }
                    
                    // Guardar sin redondeo
                    const calSinRedondeo = parseFloat(calificacionFinal.toFixed(2));
                    await pool.query(`
                        INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                        VALUES ($1, $2, 'final_sin_redondeo', $3, NOW())
                        ON CONFLICT (estudiante_id, materia_id, tipo) 
                        DO UPDATE SET calificacion = EXCLUDED.calificacion
                    `, [estudiante.id, materiaIdNum, calSinRedondeo]);
                    
                    // Guardar redondeada
                    const calRedondeada = redondearCalificacion(calificacionFinal);
                    await pool.query(`
                        INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                        VALUES ($1, $2, 'final', $3, NOW())
                        ON CONFLICT (estudiante_id, materia_id, tipo) 
                        DO UPDATE SET calificacion = EXCLUDED.calificacion
                    `, [estudiante.id, materiaIdNum, calRedondeada]);
                    
                    console.log(`✅ Calificación calculada: ${estudiante.nombre} - sin redondeo: ${calSinRedondeo}, redondeada: ${calRedondeada}`);
                    calculados++;
                    
                } catch (error) {
                    console.error(`❌ Error calculando calificación para estudiante ${estudiante.id}:`, error.message);
                }
            }
            
            console.log(`✅ Calificaciones finales calculadas para ${calculados} estudiantes`);
            
            res.json({ 
                message: 'Calificaciones calculadas correctamente', 
                calculados: calculados,
                total_estudiantes: estudiantesRows.length
            });
            
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
            
            // Verificar qué tablas de inscripción existen en la BD
            const tablesCheck = await pool.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('inscripciones', 'materias_estudiantes')
            `);
            const existingTables = tablesCheck.rows.map(r => r.table_name);
            const hasInscripciones = existingTables.includes('inscripciones');
            const hasMateriasEstudiantes = existingTables.includes('materias_estudiantes');
            
            console.log('📋 Tablas de inscripción disponibles:', existingTables);
            
            // Construir query dinámicamente según las tablas que existan
            let conditions = [];
            
            if (hasInscripciones) {
                conditions.push(`EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.estudiante_id = $1)`);
            }
            if (hasMateriasEstudiantes) {
                conditions.push(`EXISTS (SELECT 1 FROM materias_estudiantes me WHERE me.materia_id = m.id AND me.estudiante_id = $1 AND me.activo = true)`);
            }
            conditions.push(`EXISTS (SELECT 1 FROM calificaciones c WHERE c.materia_id = m.id AND c.estudiante_id = $1)`);
            
            const whereClause = conditions.join(' OR ');
            
            const materiasQuery = await pool.query(`
                SELECT DISTINCT m.id, m.nombre, m.clave, u.nombre as profesor
                FROM materias m
                LEFT JOIN usuarios u ON m.profesor_id = u.id
                WHERE ${whereClause}
                ORDER BY m.nombre
            `, [alumno_id]);
            
            console.log(`📊 Materias encontradas para alumno ${alumno_id}: ${materiasQuery.rows.length}`);

            // Obtener calificaciones detalladas por materia
            const materiasConCalificaciones = await Promise.all(
                materiasQuery.rows.map(async (materia) => {
                    const calificacionesQuery = await pool.query(
                        'SELECT tipo, calificacion, fecha_registro FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 ORDER BY tipo',
                        [alumno_id, materia.id]
                    );
                    
                    // Obtener ponderaciones reales de la materia (si la tabla existe)
                    const ponderaciones = {};
                    try {
                        const ponderacionesQuery = await pool.query(
                            'SELECT tipo, peso FROM ponderaciones WHERE materia_id = $1',
                            [materia.id]
                        );
                        ponderacionesQuery.rows.forEach(p => {
                            ponderaciones[p.tipo] = parseFloat(p.peso);
                        });
                    } catch (e) {
                        console.log('⚠️ Tabla ponderaciones no disponible, usando valores por defecto');
                    }
                    
                    // Valores por defecto si no hay ponderaciones configuradas
                    if (Object.keys(ponderaciones).length === 0) {
                        ponderaciones.tarea = 20;
                        ponderaciones.examen = 30;
                        ponderaciones.participacion = 10;
                        ponderaciones.proyecto = 25;
                        ponderaciones.practica = 15;
                    }
                    
                    // Calcular calificación final con las ponderaciones reales
                    const calificaciones = calificacionesQuery.rows;
                    let tareas = null, examenes = null, participacion = null, proyectos = null, practicas = null;
                    let tieneAlgunaCalificacion = false;
                    
                    calificaciones.forEach(cal => {
                        tieneAlgunaCalificacion = true;
                        switch(cal.tipo) {
                            case 'tarea': tareas = parseFloat(cal.calificacion); break;
                            case 'examen': examenes = parseFloat(cal.calificacion); break;
                            case 'participacion': participacion = parseFloat(cal.calificacion); break;
                            case 'proyecto': proyectos = parseFloat(cal.calificacion); break;
                            case 'practica': practicas = parseFloat(cal.calificacion); break;
                        }
                    });
                    
                    let calificacionFinal = 0;
                    if (tieneAlgunaCalificacion) {
                        calificacionFinal = (
                            (tareas || 0) * (ponderaciones.tarea || 0) / 100 +
                            (examenes || 0) * (ponderaciones.examen || 0) / 100 +
                            (participacion || 0) * (ponderaciones.participacion || 0) / 100 +
                            (proyectos || 0) * (ponderaciones.proyecto || 0) / 100 +
                            (practicas || 0) * (ponderaciones.practica || 0) / 100
                        );
                        calificacionFinal = Math.max(0, Math.min(10, calificacionFinal));
                    }
                    
                    // Usar calificaciones almacenadas si existen
                    const finalRedondeado = calificaciones.find(c => c.tipo === 'final');
                    const finalSinRedondeo = calificaciones.find(c => c.tipo === 'final_sin_redondeo');
                    const finalGeneral = calificaciones.find(c => c.tipo === 'general');
                    
                    let calFinalSinRedondeo = calificacionFinal;
                    let calRedondeada = redondearCalificacion(calificacionFinal);
                    
                    if (finalSinRedondeo) {
                        calFinalSinRedondeo = parseFloat(finalSinRedondeo.calificacion);
                    }
                    if (finalRedondeado) {
                        calRedondeada = parseFloat(finalRedondeado.calificacion);
                    } else if (finalGeneral) {
                        calRedondeada = parseFloat(finalGeneral.calificacion);
                    }
                    
                    return {
                        materia_id: materia.id,
                        nombre: materia.nombre,
                        clave: materia.clave,
                        profesor: materia.profesor,
                        calificaciones: calificacionesQuery.rows,
                        tareas,
                        examenes,
                        participacion,
                        proyectos,
                        practicas,
                        calificacion_redondeada: calRedondeada,
                        promedio_final: calFinalSinRedondeo,
                        calificacion_final: calFinalSinRedondeo,
                        ponderaciones
                    };
                })
            );

            // Calcular estadísticas generales
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
            
            // Verificar qué tablas existen
            const tablesCheck = await pool.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('inscripciones', 'materias_estudiantes')
            `);
            const existingTables = tablesCheck.rows.map(r => r.table_name);
            
            // Verificar inscripción en cualquier tabla disponible
            let isEnrolled = false;
            
            if (existingTables.includes('inscripciones')) {
                const check = await pool.query('SELECT 1 FROM inscripciones WHERE estudiante_id = $1 AND materia_id = $2 LIMIT 1', [alumno_id, materia_id]);
                if (check.rows.length > 0) isEnrolled = true;
            }
            if (!isEnrolled && existingTables.includes('materias_estudiantes')) {
                const check = await pool.query('SELECT 1 FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2 LIMIT 1', [alumno_id, materia_id]);
                if (check.rows.length > 0) isEnrolled = true;
            }
            if (!isEnrolled) {
                const check = await pool.query('SELECT 1 FROM estudiantes WHERE id = $1 AND materia_id = $2 LIMIT 1', [alumno_id, materia_id]);
                if (check.rows.length > 0) isEnrolled = true;
            }
            if (!isEnrolled) {
                const check = await pool.query('SELECT 1 FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2 LIMIT 1', [alumno_id, materia_id]);
                if (check.rows.length > 0) isEnrolled = true;
            }
            
            if (!isEnrolled) {
                return res.status(404).json({ message: 'No estás inscrito en esta materia' });
            }

            // Eliminar calificaciones del alumno en esa materia
            await pool.query(
                'DELETE FROM calificaciones WHERE estudiante_id = $1 AND materia_id = $2',
                [alumno_id, materia_id]
            );

            // Eliminar de inscripciones (si la tabla existe)
            if (existingTables.includes('inscripciones')) {
                await pool.query(
                    'DELETE FROM inscripciones WHERE estudiante_id = $1 AND materia_id = $2',
                    [alumno_id, materia_id]
                );
            }

            // Eliminar de materias_estudiantes (si la tabla existe)
            if (existingTables.includes('materias_estudiantes')) {
                await pool.query(
                    'DELETE FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2',
                    [alumno_id, materia_id]
                );
            }

            // Limpiar la referencia directa en estudiantes si aplica
            await pool.query(
                'UPDATE estudiantes SET materia_id = NULL WHERE id = $1 AND materia_id = $2',
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
    async getPonderacionesMap(materiaId) {
        const ponderacionesQuery = await pool.query(
            'SELECT tipo, peso FROM ponderaciones WHERE materia_id = $1',
            [materiaId]
        );
        const ponderaciones = {
            tarea: 20,
            examen: 30,
            participacion: 10,
            proyecto: 20,
            practica: 20
        };
        ponderacionesQuery.rows.forEach(row => {
            ponderaciones[row.tipo] = parseFloat(row.peso);
        });
        return ponderaciones;
    },

    async persistirEstudianteNormalizado(estudiante, materiaId, ponderaciones, options = {}) {
        const { crearSiNoExiste = true, estudianteIdForzado = null } = options;
        const matricula = String(getStudentPayloadValue(estudiante, ['ID', 'Matrícula', 'Matricula', 'matricula']) || '').trim();
        const nombreDirecto = String(getStudentPayloadValue(estudiante, ['Nombre de Alumno', 'Nombre Completo', 'Nombre Completo', 'Nombre completo', 'nombre_completo']) || '').trim();
        const nombreConApellidos = buildNombreCompleto(
            getStudentPayloadValue(estudiante, ['Nombre', 'nombre']),
            getStudentPayloadValue(estudiante, ['Apellidos', 'apellidos'])
        );
        const nombre = nombreDirecto || nombreConApellidos;
        const email = String(getStudentPayloadValue(estudiante, ['Email', 'Correo', 'email']) || '').trim();

        if (!matricula && !nombre) return { omitido: true };

        const matriculaFinal = matricula || `AUTO_${Date.now()}_${Math.round(Math.random() * 100000)}`;
        const nombreFinal = nombre || 'Sin nombre';
        let existingEstudiante = estudianteIdForzado ? { rows: [{ id: estudianteIdForzado }] } : { rows: [] };
        if (!estudianteIdForzado && matricula) {
            existingEstudiante = await pool.query('SELECT id FROM estudiantes WHERE matricula = $1', [matricula]);
        }
        if (!estudianteIdForzado && existingEstudiante.rows.length === 0 && email) {
            existingEstudiante = await pool.query('SELECT id FROM estudiantes WHERE LOWER(email) = LOWER($1)', [email]);
        }
        if (!estudianteIdForzado && existingEstudiante.rows.length === 0 && nombre) {
            existingEstudiante = await pool.query(`
                SELECT e.id
                FROM estudiantes e
                WHERE LOWER(REGEXP_REPLACE(e.nombre, '\\s+', ' ', 'g')) = LOWER(REGEXP_REPLACE($1, '\\s+', ' ', 'g'))
                  AND (
                    EXISTS (SELECT 1 FROM materias_estudiantes me WHERE me.estudiante_id = e.id AND me.materia_id = $2)
                    OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.estudiante_id = e.id AND i.materia_id = $2)
                  )
                LIMIT 1
            `, [nombre, materiaId]);
        }

        let estudianteId;
        let nuevo = false;
        if (existingEstudiante.rows.length > 0) {
            estudianteId = existingEstudiante.rows[0].id;
            await pool.query(
                'UPDATE estudiantes SET nombre = COALESCE(NULLIF($1, \'\'), nombre), email = COALESCE(NULLIF($2, \'\'), email) WHERE id = $3',
                [nombreFinal, email, estudianteId]
            );
        } else if (!crearSiNoExiste) {
            return { omitido: true, noEncontrado: true };
        } else {
            const newEstudiante = await pool.query(
                `INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
                [matriculaFinal, nombreFinal, email || '', 'temporal123', 'alumno', true]
            );
            estudianteId = newEstudiante.rows[0].id;
            nuevo = true;
        }

        await pool.query(
            `INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion, activo)
             VALUES ($1, $2, NOW(), true)
             ON CONFLICT (materia_id, estudiante_id) DO UPDATE SET activo = true`,
            [materiaId, estudianteId]
        );
        await upsertInfoInscripcion(materiaId, estudianteId, estudiante);

        const calificaciones = GRADE_TYPES.map(({ tipo, labels }) => ({
            tipo,
            calificacion: parseGradeFromStudent(estudiante, labels)
        }));

        let calificacionFinal = 0;
        let totalPeso = 0;
        for (const cal of calificaciones) {
            await pool.query(`
                INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (estudiante_id, materia_id, tipo)
                DO UPDATE SET calificacion = EXCLUDED.calificacion
            `, [estudianteId, materiaId, cal.tipo, cal.calificacion]);

            const peso = ponderaciones[cal.tipo] || 0;
            if (peso > 0) {
                calificacionFinal += (cal.calificacion * peso) / 100;
                totalPeso += peso;
            }
        }

        if (totalPeso > 0) {
            if (totalPeso !== 100) calificacionFinal = (calificacionFinal * 100) / totalPeso;
            const calSinRedondeo = parseFloat(calificacionFinal.toFixed(2));
            const calRedondeada = redondearCalificacion(calificacionFinal);
            await pool.query(`
                INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                VALUES ($1, $2, 'final_sin_redondeo', $3, NOW())
                ON CONFLICT (estudiante_id, materia_id, tipo)
                DO UPDATE SET calificacion = EXCLUDED.calificacion
            `, [estudianteId, materiaId, calSinRedondeo]);
            await pool.query(`
                INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                VALUES ($1, $2, 'final', $3, NOW())
                ON CONFLICT (estudiante_id, materia_id, tipo)
                DO UPDATE SET calificacion = EXCLUDED.calificacion
            `, [estudianteId, materiaId, calRedondeada]);
        }

        return { omitido: false, nuevo };
    },

    async excelYaSincronizado(materiaId, estudiantesConMatch) {
        if (!Array.isArray(estudiantesConMatch) || estudiantesConMatch.length === 0) return false;
        const ids = estudiantesConMatch.map(({ alumno }) => alumno.id).filter(Boolean);
        if (ids.length === 0) return false;

        const existentes = await pool.query(
            `SELECT estudiante_id, tipo, calificacion
             FROM calificaciones
             WHERE materia_id = $1
               AND estudiante_id = ANY($2::int[])
               AND tipo = ANY($3::text[])`,
            [materiaId, ids, GRADE_TYPES.map(({ tipo }) => tipo)]
        );

        if (existentes.rows.length < ids.length * GRADE_TYPES.length) return false;

        const actuales = new Map();
        existentes.rows.forEach(row => {
            actuales.set(`${row.estudiante_id}:${row.tipo}`, Number.parseFloat(row.calificacion));
        });

        return estudiantesConMatch.every(({ estudiante, alumno }) =>
            buildIncomingGrades(estudiante).every(({ tipo, calificacion }) => {
                const actual = actuales.get(`${alumno.id}:${tipo}`);
                return actual !== undefined && Math.abs(actual - calificacion) < 0.001;
            })
        );
    },

    async htmlYaCargado(materiaId, estudiantesHtml) {
        if (!Array.isArray(estudiantesHtml) || estudiantesHtml.length === 0) return false;
        const alumnosMateria = await getEstudiantesDeMateria(materiaId, true);
        if (alumnosMateria.length !== estudiantesHtml.length) return false;

        const indexes = buildStudentIndexes(alumnosMateria);
        return estudiantesHtml.every((estudiante) => resolveAlumnoMatch(estudiante, indexes).alumno);
    },

    async htmlFingerprintYaRegistrado(materiaId, profesorId, fingerprint) {
        if (!fingerprint) return false;
        await ensureArchivosCalificacionesExcel();
        const result = await pool.query(
            `SELECT id
             FROM archivos_calificaciones
             WHERE materia_id = $1
               AND profesor_id = $2
               AND tipo = 'htm'
               AND (huella_contenido = $3 OR detalles LIKE $4)
             LIMIT 1`,
            [materiaId, profesorId, fingerprint, `%HTM_FINGERPRINT:${fingerprint}%`]
        );
        return result.rowCount > 0;
    },

    async processExcelFile(filePath, materiaId, profesorId) {
        try {
            console.log('📄 Procesando archivo Excel:', filePath);
            const workbook = XLSX.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
            const headerIndex = rawRows.findIndex(isExcelHeaderRow);
            const rows = headerIndex >= 0
                ? XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, range: headerIndex })
                : XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
            const ponderaciones = await calificacionController.getPonderacionesMap(materiaId);

            let procesados = 0;
            let nuevos = 0;
            let actualizados = 0;
            const noEncontrados = [];
            const agrupados = new Map();
            const alumnosMateria = await getEstudiantesDeMateria(materiaId, true);
            const alumnoIndexes = buildStudentIndexes(alumnosMateria);

            rows.forEach((row, index) => {
                const email = getValueByLabels(row, ['Dirección de correo', 'Direccion de correo', 'Email', 'Correo']);
                const nombreCompleto = getValueByLabels(row, ['Nombre Completo', 'Nombre de Alumno', 'Nombre completo']);
                const nombre = getValueByLabels(row, ['Nombre']);
                const apellidos = getValueByLabels(row, ['Apellidos']);
                const matricula = getValueByLabels(row, ['Matrícula', 'Matricula', 'ID']);
                const key = normalizeKey(matricula || nombreCompleto || buildNombreCompleto(nombre, apellidos) || email || `fila ${index}`);
                if (!key) return;

                const directGrades = {};
                GRADE_TYPES.forEach(({ tipo, labels }) => {
                    const directValue = getDirectGradeValue(row, labels);
                    if (directValue !== null) directGrades[tipo] = directValue;
                });

                const porcentaje = getNumericPayloadValue(row, ['Porcentaje']);
                const puntos = getNumericPayloadValue(row, ['Puntos']);
                const puntosMaximos = getNumericPayloadValue(row, ['Puntos máximos', 'Puntos maximos']);
                let calificacion = null;
                if (porcentaje !== null) calificacion = porcentaje <= 1 ? porcentaje * 10 : porcentaje;
                else if (puntos !== null && puntosMaximos && puntosMaximos > 0) calificacion = (puntos / puntosMaximos) * 10;
                else calificacion = getNumericPayloadValue(row, ['Calificación', 'Calificacion']);

                if (!agrupados.has(key)) {
                    agrupados.set(key, {
                        'Número de Registro': index + 1,
                        'Nombre de Alumno': nombreCompleto || buildNombreCompleto(nombre, apellidos),
                        Nombre: nombre,
                        Apellidos: apellidos,
                        ID: matricula,
                        'Status de Inscripción': getValueByLabels(row, ['Status de Inscripción', 'Status']),
                        Nivel: getValueByLabels(row, ['Nivel']),
                        'Créditos': getValueByLabels(row, ['Créditos', 'Creditos']),
                        Email: email,
                        Tareas: 0,
                        Examenes: 0,
                        Participacion: 0,
                        Proyectos: 0,
                        Practicas: 0,
                        _tareasValores: []
                    });
                }
                Object.entries(directGrades).forEach(([tipo, value]) => {
                    assignGrade(agrupados.get(key), tipo, value);
                });

                if (calificacion !== null && Object.keys(directGrades).length === 0) {
                    agrupados.get(key)._tareasValores.push(normalizarCalificacion(calificacion));
                }
            });

            const estudiantes = Array.from(agrupados.values()).map(estudiante => {
                if (estudiante._tareasValores.length > 0) {
                    const suma = estudiante._tareasValores.reduce((acc, val) => acc + val, 0);
                    estudiante.Tareas = parseFloat((suma / estudiante._tareasValores.length).toFixed(2));
                }
                delete estudiante._tareasValores;
                return estudiante;
            }).filter(row => row.ID || row.Email || row['Nombre de Alumno']);

            const estudiantesConMatch = [];
            for (const estudiante of estudiantes) {
                const match = resolveAlumnoMatch(estudiante, alumnoIndexes);
                if (!match.alumno) {
                    noEncontrados.push(match.error);
                    continue;
                }
                estudiantesConMatch.push({ estudiante, alumno: match.alumno });
            }

            if (noEncontrados.length > 0) {
                return { procesados, nuevos, actualizados, noEncontrados, estudiantes };
            }

            const yaSincronizado = await calificacionController.excelYaSincronizado(
                materiaId,
                estudiantesConMatch
            );
            if (yaSincronizado) {
                return {
                    procesados,
                    nuevos,
                    actualizados,
                    noEncontrados,
                    estudiantes,
                    duplicado: true,
                    message: 'Este Excel ya fue cargado para esta materia y las calificaciones son identicas.'
                };
            }

            for (const { estudiante, alumno } of estudiantesConMatch) {
                const resultado = await calificacionController.persistirEstudianteNormalizado(
                    estudiante,
                    materiaId,
                    ponderaciones,
                    { crearSiNoExiste: false, estudianteIdForzado: alumno.id }
                );
                if (resultado.noEncontrado) {
                    noEncontrados.push({
                        excel: estudiante['Nombre de Alumno'] || estudiante.ID || estudiante.Email || 'Fila sin identificador',
                        htm: 'No se encontró en la lista HTM procesada',
                        motivo: 'no_encontrado'
                    });
                    continue;
                }
                if (resultado.omitido) continue;
                procesados++;
                if (resultado.nuevo) nuevos++;
                else actualizados++;
            }

            return { procesados, nuevos, actualizados, noEncontrados, estudiantes };
        } catch (error) {
            console.error('❌ Error al procesar archivo Excel:', error);
            throw error;
        }
    },

    async processHtmlFile(filePath, materiaId, profesorId) {
        try {
            console.log('📄 Procesando archivo HTML:', filePath);
            
            // Leer el archivo HTML
            const htmlContent = fs.readFileSync(filePath, 'utf8');
            const $ = cheerio.load(htmlContent);

            const estudiantesHtml = extractStudentsFromHtml($);
            if (estudiantesHtml.length > 0) {
                const fingerprint = buildHtmlStudentFingerprint(estudiantesHtml);
                const htmRepetido = await calificacionController.htmlFingerprintYaRegistrado(materiaId, profesorId, fingerprint)
                    || await calificacionController.htmlYaCargado(materiaId, estudiantesHtml);

                if (htmRepetido) {
                    return {
                        procesados: 0,
                        nuevos: 0,
                        actualizados: 0,
                        estudiantes: estudiantesHtml,
                        duplicado: true,
                        fingerprint,
                        message: 'Este archivo HTM ya fue cargado para esta materia. La lista de alumnos es la misma.'
                    };
                }

                const ponderaciones = await calificacionController.getPonderacionesMap(materiaId);
                let procesados = 0;
                let nuevos = 0;
                let actualizados = 0;

                for (const estudiante of estudiantesHtml) {
                    try {
                        const resultado = await calificacionController.persistirEstudianteNormalizado(
                            estudiante,
                            materiaId,
                            ponderaciones,
                            { crearSiNoExiste: true }
                        );
                        if (resultado.omitido) continue;
                        procesados++;
                        if (resultado.nuevo) nuevos++;
                        else actualizados++;
                    } catch (error) {
                        console.error(`Error procesando estudiante ${estudiante.ID || estudiante['Nombre de Alumno']}:`, error.message);
                    }
                }

                console.log(`Archivo HTML procesado con parser de lista: ${procesados} estudiantes encontrados`);
                return {
                    procesados,
                    nuevos,
                    actualizados,
                    estudiantes: estudiantesHtml,
                    fingerprint
                };
            }
            
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
                
                // Mapeo de columnas basado en encabezados - mejorado y más robusto
                const columnMapping = {};
                headers.forEach((header, index) => {
                    const cleanHeader = header.toLowerCase().trim();
                    console.log(`🔍 Analizando encabezado [${index}]: "${cleanHeader}"`);
                    
                    // Matrícula - más términos posibles
                    if (cleanHeader.includes('matrícula') || cleanHeader.includes('matricula') || 
                        cleanHeader.includes('mat') || cleanHeader.includes('no.') || 
                        cleanHeader.includes('numero') || cleanHeader.includes('expediente')) {
                        columnMapping.matricula = index;
                        console.log(`✅ Columna matrícula detectada en índice ${index}`);
                    } 
                    // Nombre - más términos posibles
                    else if (cleanHeader.includes('nombre') || cleanHeader.includes('name') || 
                             cleanHeader.includes('alumno') || cleanHeader.includes('estudiante')) {
                        columnMapping.nombre = index;
                        console.log(`✅ Columna nombre detectada en índice ${index}`);
                    } 
                    // Email - más términos posibles
                    else if (cleanHeader.includes('email') || cleanHeader.includes('correo') || 
                             cleanHeader.includes('e-mail') || cleanHeader.includes('mail')) {
                        columnMapping.email = index;
                        console.log(`✅ Columna email detectada en índice ${index}`);
                    } 
                    // Tareas - más términos posibles
                    else if (cleanHeader.includes('tarea') || cleanHeader.includes('task') || 
                             cleanHeader.includes('trabajo') || cleanHeader.includes('homework')) {
                        columnMapping.tareas = index;
                        console.log(`✅ Columna tareas detectada en índice ${index}`);
                    } 
                    // Exámenes - más términos posibles
                    else if (cleanHeader.includes('examen') || cleanHeader.includes('exam') || 
                             cleanHeader.includes('prueba') || cleanHeader.includes('test')) {
                        columnMapping.examenes = index;
                        console.log(`✅ Columna exámenes detectada en índice ${index}`);
                    } 
                    // Participación - más términos posibles
                    else if (cleanHeader.includes('participación') || cleanHeader.includes('participacion') || 
                             cleanHeader.includes('particip') || cleanHeader.includes('asistencia')) {
                        columnMapping.participacion = index;
                        console.log(`✅ Columna participación detectada en índice ${index}`);
                    } 
                    // Proyectos - más términos posibles
                    else if (cleanHeader.includes('proyecto') || cleanHeader.includes('project') || 
                             cleanHeader.includes('proyect')) {
                        columnMapping.proyectos = index;
                        console.log(`✅ Columna proyectos detectada en índice ${index}`);
                    } 
                    // Prácticas - más términos posibles
                    else if (cleanHeader.includes('práctica') || cleanHeader.includes('practica') || 
                             cleanHeader.includes('practice') || cleanHeader.includes('lab') ||
                             cleanHeader.includes('laboratorio')) {
                        columnMapping.practicas = index;
                        console.log(`✅ Columna prácticas detectada en índice ${index}`);
                    } 
                    // Final - más términos posibles
                    else if (cleanHeader.includes('final') || cleanHeader.includes('calificación') || 
                             cleanHeader.includes('calificacion') || cleanHeader.includes('promedio') ||
                             cleanHeader.includes('average') || cleanHeader.includes('grade')) {
                        columnMapping.final = index;
                        console.log(`✅ Columna final detectada en índice ${index}`);
                    }
                    // Si es un número, podría ser una calificación sin nombre específico
                    else if (/^\d+(\.\d+)?$/.test(cleanHeader) || 
                             (cleanHeader.includes('calif') || cleanHeader.includes('nota'))) {
                        // Asignar a la primera columna de calificación disponible
                        if (!columnMapping.tareas) {
                            columnMapping.tareas = index;
                            console.log(`✅ Columna numérica asignada a tareas en índice ${index}`);
                        } else if (!columnMapping.examenes) {
                            columnMapping.examenes = index;
                            console.log(`✅ Columna numérica asignada a exámenes en índice ${index}`);
                        } else if (!columnMapping.participacion) {
                            columnMapping.participacion = index;
                            console.log(`✅ Columna numérica asignada a participación en índice ${index}`);
                        }
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
                    
                    // Si no hay mapeo o es incompleto, usar heurística automática mejorada
                    if (Object.keys(columnMapping).length < 3) { // Si hay menos de 3 columnas mapeadas
                        console.log('🔍 Usando heurística automática mejorada para la fila:', rowData);
                        
                        // Detectar automáticamente con mejor lógica
                        for (let i = 0; i < rowData.length; i++) {
                            const value = rowData[i].trim();
                            
                            // Saltar valores vacíos
                            if (!value || value === '' || value === '-') continue;
                            
                            // Matrícula (varios formatos posibles)
                            if ((/^\d{6,10}$/.test(value) || /^\d{4}-\d{4}$/.test(value)) && !matricula) {
                                matricula = value;
                                console.log(`🔍 Matrícula detectada: "${value}" en posición ${i}`);
                            }
                            // Email (contiene @ y tiene formato válido)
                            else if (value.includes('@') && value.includes('.') && !email) {
                                email = value;
                                console.log(`🔍 Email detectado: "${value}" en posición ${i}`);
                            }
                            // Nombre (texto con letras y espacios, no números ni @)
                            else if (!/^\d+$/.test(value) && !value.includes('@') && !nombre && 
                                     value.length > 2 && /[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(value)) {
                                nombre = value;
                                console.log(`🔍 Nombre detectado: "${value}" en posición ${i}`);
                            }
                            // Calificaciones (números entre 0 y 10, incluyendo decimales)
                            else {
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
                                    // Asignar en orden si no hay mapeo específico
                                    if (!columnMapping.tareas && !tareas) {
                                        tareas = numValue;
                                        columnMapping.tareas = i;
                                        console.log(`🔍 Tareas detectadas: ${numValue} en posición ${i}`);
                                    }
                                    else if (!columnMapping.examenes && !examenes) {
                                        examenes = numValue;
                                        columnMapping.examenes = i;
                                        console.log(`🔍 Exámenes detectados: ${numValue} en posición ${i}`);
                                    }
                                    else if (!columnMapping.participacion && !participacion) {
                                        participacion = numValue;
                                        columnMapping.participacion = i;
                                        console.log(`🔍 Participación detectada: ${numValue} en posición ${i}`);
                                    }
                                    else if (!columnMapping.proyectos && !proyectos) {
                                        proyectos = numValue;
                                        columnMapping.proyectos = i;
                                        console.log(`🔍 Proyectos detectados: ${numValue} en posición ${i}`);
                                    }
                                    else if (!columnMapping.practicas && !practicas) {
                                        practicas = numValue;
                                        columnMapping.practicas = i;
                                        console.log(`🔍 Prácticas detectadas: ${numValue} en posición ${i}`);
                                    }
                                    else if (!columnMapping.final && !calificacionFinal) {
                                        calificacionFinal = numValue;
                                        columnMapping.final = i;
                                        console.log(`🔍 Calificación final detectada: ${numValue} en posición ${i}`);
                                    }
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
                    
                    // Validar datos mínimos y mostrar detalles completos
                    if (matricula || nombre) {
                        const estudianteProcesado = {
                            matricula: matricula || 'AUTO_' + Date.now() + '_' + rowIndex,
                            nombre: nombre || 'Sin nombre',
                            email: email || '',
                            tareas,
                            examenes,
                            participacion,
                            proyectos,
                            practicas,
                            calificacion_final: calificacionFinal,
                            // Guardar también los datos originales para depuración
                            datos_originales: rowData,
                            mapeo_usado: columnMapping
                        };
                        
                        estudiantes.push(estudianteProcesado);
                        procesados++;
                        
                        console.log(`✅ Estudiante procesado: ${nombre} (${matricula})`);
                        console.log(`📊 Datos completos:`, {
                            matricula,
                            nombre,
                            email,
                            tareas,
                            examenes,
                            participacion,
                            proyectos,
                            practicas,
                            calificacionFinal,
                            fila_original: rowData,
                            mapeo_columnas: columnMapping
                        });
                    } else {
                        console.log(`⚠️ Fila ignorada - datos insuficientes:`, {
                            rowIndex,
                            rowData,
                            matricula,
                            nombre,
                            columnMapping
                        });
                    }
                });
            });
            
            console.log(`✅ Archivo HTML procesado: ${procesados} estudiantes encontrados`);

            const fingerprint = buildHtmlStudentFingerprint(estudiantes);
            const htmRepetido = await calificacionController.htmlFingerprintYaRegistrado(materiaId, profesorId, fingerprint)
                || await calificacionController.htmlYaCargado(materiaId, estudiantes);

            if (htmRepetido) {
                return {
                    procesados: 0,
                    nuevos: 0,
                    actualizados: 0,
                    estudiantes,
                    duplicado: true,
                    fingerprint,
                    message: 'Este archivo HTM ya fue cargado para esta materia. La lista de alumnos es la misma.'
                };
            }
            
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
                        await pool.query(
                            `INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion, activo)
                             VALUES ($1, $2, NOW(), true)
                             ON CONFLICT (materia_id, estudiante_id) DO UPDATE SET activo = true`,
                            [materiaId, estudianteId]
                        );
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
                            `INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion, activo)
                             VALUES ($1, $2, NOW(), true)
                             ON CONFLICT (materia_id, estudiante_id) DO UPDATE SET activo = true`,
                            [materiaId, estudianteId]
                        );
                    }
                    
                    await upsertInfoInscripcion(materiaId, estudianteId, estudiante);

                    // Obtener ponderaciones de la materia para aplicarlas
                    const ponderacionesQuery = await pool.query(
                        'SELECT tipo, peso FROM ponderaciones WHERE materia_id = $1',
                        [materiaId]
                    );
                    
                    const ponderaciones = {};
                    ponderacionesQuery.rows.forEach(row => {
                        ponderaciones[row.tipo] = row.peso;
                    });
                    
                    console.log('📊 Ponderaciones encontradas para materia:', ponderaciones);
                    
                    // Guardar calificaciones aplicando ponderaciones
                    const calificaciones = [
                        { tipo: 'tarea', calificacion: normalizarCalificacion(estudiante.tareas || 0) },
                        { tipo: 'examen', calificacion: normalizarCalificacion(estudiante.examenes || 0) },
                        { tipo: 'participacion', calificacion: normalizarCalificacion(estudiante.participacion || 0) },
                        { tipo: 'proyecto', calificacion: normalizarCalificacion(estudiante.proyectos || 0) },
                        { tipo: 'practica', calificacion: normalizarCalificacion(estudiante.practicas || 0) }
                    ];
                    
                    let calificacionFinal = 0;
                    let totalPeso = 0;
                    
                    for (const cal of calificaciones) {
                        await pool.query(`
                            INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                            VALUES ($1, $2, $3, $4, NOW())
                            ON CONFLICT (estudiante_id, materia_id, tipo) 
                            DO UPDATE SET calificacion = EXCLUDED.calificacion
                        `, [estudianteId, materiaId, cal.tipo, cal.calificacion]);
                        
                        const peso = ponderaciones[cal.tipo] || 0;
                        if (peso > 0) {
                            calificacionFinal += (cal.calificacion * peso) / 100;
                            totalPeso += peso;
                        }
                        
                        console.log(`✅ Calificación guardada: ${estudiante.nombre} - ${cal.tipo}: ${cal.calificacion} (peso: ${peso}%)`);
                    }
                    
                    if (totalPeso > 0) {
                        if (totalPeso !== 100) {
                            calificacionFinal = (calificacionFinal * 100) / totalPeso;
                        }
                        
                        // Guardar sin redondeo
                        const calSinRedondeo = parseFloat(calificacionFinal.toFixed(2));
                        await pool.query(`
                            INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                            VALUES ($1, $2, 'final_sin_redondeo', $3, NOW())
                            ON CONFLICT (estudiante_id, materia_id, tipo) 
                            DO UPDATE SET calificacion = EXCLUDED.calificacion
                        `, [estudianteId, materiaId, calSinRedondeo]);
                        
                        // Guardar redondeada
                        const calRedondeada = redondearCalificacion(calificacionFinal);
                        await pool.query(`
                            INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                            VALUES ($1, $2, 'final', $3, NOW())
                            ON CONFLICT (estudiante_id, materia_id, tipo) 
                            DO UPDATE SET calificacion = EXCLUDED.calificacion
                        `, [estudianteId, materiaId, calRedondeada]);
                        
                        console.log(`✅ Calificación: ${estudiante.nombre} - sin redondeo: ${calSinRedondeo}, redondeada: ${calRedondeada}`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error procesando estudiante ${estudiante.matricula}:`, error.message);
                }
            }
            
            return {
                procesados,
                nuevos,
                actualizados,
                estudiantes,
                fingerprint
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
            
            // Calificaciones a guardar (normalizadas a escala 0-10)
            const calificaciones = [
                { tipo: 'tarea', calificacion: normalizarCalificacion(tareas || 0) },
                { tipo: 'examen', calificacion: normalizarCalificacion(examenes || 0) },
                { tipo: 'participacion', calificacion: normalizarCalificacion(participacion || 0) },
                { tipo: 'proyecto', calificacion: normalizarCalificacion(proyectos || 0) },
                { tipo: 'practica', calificacion: normalizarCalificacion(practicas || 0) }
            ];
            
            for (const cal of calificaciones) {
                if (cal.calificacion >= 0 && cal.calificacion <= 10) {
                    await pool.query(`
                        INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (estudiante_id, materia_id, tipo) 
                        DO UPDATE SET calificacion = $4
                    `, [estudianteIdNum, materiaIdNum, cal.tipo, cal.calificacion]);
                }
            }
            
            // Calcular calificación final
            const calFinalRaw = this.calcularFinal({
                tareas: normalizarCalificacion(tareas || 0),
                examenes: normalizarCalificacion(examenes || 0),
                participacion: normalizarCalificacion(participacion || 0),
                proyectos: normalizarCalificacion(proyectos || 0),
                practicas: normalizarCalificacion(practicas || 0)
            });
            
            // Guardar sin redondeo
            const calSinRedondeo = parseFloat(calFinalRaw.toFixed(2));
            await pool.query(`
                INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                VALUES ($1, $2, 'final_sin_redondeo', $3, NOW())
                ON CONFLICT (estudiante_id, materia_id, tipo) 
                DO UPDATE SET calificacion = $3
            `, [estudianteIdNum, materiaIdNum, calSinRedondeo]);
            
            // Guardar redondeada
            const calRedondeada = redondearCalificacion(calFinalRaw);
            await pool.query(`
                INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion, created_at)
                VALUES ($1, $2, 'final', $3, NOW())
                ON CONFLICT (estudiante_id, materia_id, tipo) 
                DO UPDATE SET calificacion = $3
            `, [estudianteIdNum, materiaIdNum, calRedondeada]);
            
            console.log('✅ Calificaciones guardadas para estudiante:', estudianteIdNum);
            res.json({ 
                message: 'Calificaciones guardadas correctamente',
                calificacion_redondeada: calRedondeada,
                calificacion_final: calSinRedondeo
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
