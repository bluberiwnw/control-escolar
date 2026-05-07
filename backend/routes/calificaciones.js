const express = require('express');
const router = express.Router();
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Rutas para profesores y administradores (solo funciones que existen)
router.post('/upload', verificarRol(['profesor', 'administrador']), calificacionController.uploadFile);
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