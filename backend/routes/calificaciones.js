const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Configuración de multer para archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ 
    storage: storage, // Usar diskStorage simple
    limits: { 
        fileSize: 100 * 1024 * 1024, // 100MB
        fieldSize: 100 * 1024 * 1024, // 100MB para campos
        fields: 50, // máximo 50 campos
        files: 5, // máximo 5 archivos
        parts: 55 // máximo 55 partes (50 campos + 5 archivos)
    }
    // Sin fileFilter para evitar errores de validación
});

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Body parser solo para rutas que no usan multer
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Rutas para profesores y administradores (solo funciones que existen)
router.post('/upload', verificarRol(['profesor', 'administrador']), (req, res, next) => {
    console.log('🔍 DEBUG UPLOAD - Inicio middleware');
    console.log('🔍 DEBUG UPLOAD - Headers:', {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length'],
        'user-agent': req.headers['user-agent']
    });
    
    // Intentar procesar con multer
    upload.single('archivo')(req, res, (err) => {
        if (err) {
            console.error('❌ DEBUG UPLOAD - Error en multer:', err);
            console.error('❌ DEBUG UPLOAD - Detalles:', {
                name: err.name,
                message: err.message,
                code: err.code,
                limit: err.limit,
                field: err.field,
                storageErrors: err.storageErrors
            });
            return res.status(400).json({ 
                message: 'Error al procesar archivo: ' + err.message,
                error: err.message,
                details: err
            });
        }
        
        console.log('✅ DEBUG UPLOAD - Multer procesado correctamente');
        console.log('🔍 DEBUG UPLOAD - req.file:', req.file ? 'EXISTS' : 'NULL');
        console.log('🔍 DEBUG UPLOAD - req.body:', req.body ? 'EXISTS' : 'NULL');
        
        if (req.file) {
            console.log('🔍 DEBUG UPLOAD - Archivo:', {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });
        }
        
        next();
    });
}, calificacionController.uploadFile);
router.get('/plantilla', verificarRol(['profesor', 'administrador']), calificacionController.getPlantilla);
router.get('/archivos', verificarRol(['profesor', 'administrador']), calificacionController.getArchivos);
router.get('/archivos/:id/descarga', verificarRol(['profesor', 'administrador']), calificacionController.descargarArchivoCalificacion);
router.delete('/archivos/:id', verificarRol(['profesor', 'administrador']), calificacionController.deleteArchivo);

// Rutas para CRUD de alumnos (solo profesores)
router.get('/materia/:materia_id/alumnos', verificarRol(['profesor', 'administrador']), calificacionController.getAlumnosByMateria);
router.post('/alumnos', verificarRol(['profesor', 'administrador']), calificacionController.createAlumno);
router.put('/alumnos/:id', verificarRol(['profesor', 'administrador']), calificacionController.updateAlumno);
router.delete('/alumnos/:id', verificarRol(['profesor', 'administrador']), calificacionController.deleteAlumno);
router.get('/materia/:materia_id/exportar', verificarRol(['profesor', 'administrador']), calificacionController.exportToExcel);

// Rutas para ponderaciones (solo profesores)
router.post('/ponderaciones', verificarRol(['profesor', 'administrador']), calificacionController.guardarPonderaciones);
router.get('/ponderaciones/:materia_id', verificarRol(['profesor', 'administrador']), calificacionController.getPonderaciones);
router.post('/calcular/:materia_id', verificarRol(['profesor', 'administrador']), calificacionController.calcularCalificaciones);

// Rutas para actualización de calificaciones individuales
router.put('/actualizar', verificarRol(['profesor', 'administrador']), calificacionController.actualizarCalificacion);
router.get('/estudiante/:estudiante_id/materia/:materia_id', verificarRol(['profesor', 'administrador']), calificacionController.getCalificacionesEstudiante);

// Ruta para guardar calificaciones completas de un alumno
router.post('/guardar-calificaciones-alumno', verificarRol(['profesor', 'administrador']), calificacionController.guardarCalificacionesAlumno);

// Rutas para procesamiento definitivo HTM
router.post('/procesar-definitivo', verificarRol(['profesor', 'administrador']), calificacionController.procesarDefinitivo);

// Rutas para alumnos (separadas para no tener conflicto de roles)
router.get('/alumno/todas', verificarRol(['alumno']), calificacionController.getAllCalificacionesAlumno);
router.delete('/alumno/materia/:materia_id/baja', verificarRol(['alumno']), calificacionController.darseDeBajaMateria);

module.exports = router;