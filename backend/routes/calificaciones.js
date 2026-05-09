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
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        console.log(' Multer fileFilter - Archivo recibido:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            fieldname: file.fieldname
        });
        
        const allowedMimes = ['text/html', 'text/htm'];
        const allowedExtensions = ['.htm', '.html'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
            console.log(' Multer fileFilter - Archivo aceptado');
            cb(null, true);
        } else {
            console.log(' Multer fileFilter - Archivo rechazado');
            cb(new Error('Solo se permiten archivos HTM/HTML'), false);
        }
    }
});

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Body parser solo para rutas que no usan multer
router.use('/alumnos', express.json());
router.use('/alumnos', express.urlencoded({ extended: true }));
router.use('/ponderaciones', express.json());
router.use('/ponderaciones', express.urlencoded({ extended: true }));
router.use('/actualizar', express.json());
router.use('/actualizar', express.urlencoded({ extended: true }));
router.use('/calcular', express.json());
router.use('/calcular', express.urlencoded({ extended: true }));

// Rutas para profesores y administradores (solo funciones que existen)
router.post('/upload', verificarRol(['profesor', 'administrador']), (req, res, next) => {
    console.log(' Upload middleware - Headers:', req.headers);
    console.log(' Upload middleware - Content-Type:', req.headers['content-type']);
    console.log(' Upload middleware - Content-Length:', req.headers['content-length']);
    next();
}, upload.single('archivo'), (req, res, next) => {
    console.log(' Upload middleware - Después de multer:');
    console.log(' Upload middleware - req.file:', req.file ? 'EXISTS' : 'UNDEFINED');
    console.log(' Upload middleware - req.body:', req.body);
    next();
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