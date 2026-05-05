const express = require('express');
const router = express.Router();
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Rutas para profesores y administradores
router.post('/upload', verificarRol(['profesor', 'administrador']), calificacionController.uploadFile);
router.get('/plantilla', verificarRol(['profesor', 'administrador']), calificacionController.getPlantilla);
router.get('/archivos', verificarRol(['profesor', 'administrador']), calificacionController.getArchivos);
router.get('/archivos/:id/descarga', verificarRol(['profesor', 'administrador']), calificacionController.descargarArchivoCalificacion);
router.delete('/archivos/:id', verificarRol(['profesor', 'administrador']), calificacionController.deleteArchivo);
router.get('/materia/:materia_id', verificarRol(['profesor', 'administrador']), calificacionController.getByMateria);
router.post('/', verificarRol(['profesor', 'administrador']), calificacionController.save);
router.get('/estadisticas/:materia_id', verificarRol(['profesor', 'administrador']), calificacionController.getEstadisticas);

// Rutas para CRUD de alumnos (solo profesores)
router.get('/materia/:materia_id/alumnos', verificarRol(['profesor', 'administrador']), calificacionController.getAlumnosByMateria);
router.post('/alumnos', verificarRol(['profesor', 'administrador']), calificacionController.createAlumno);
router.put('/alumnos/:id', verificarRol(['profesor', 'administrador']), calificacionController.updateAlumno);
router.delete('/alumnos/:id', verificarRol(['profesor', 'administrador']), calificacionController.deleteAlumno);
router.get('/materia/:materia_id/exportar', verificarRol(['profesor', 'administrador']), calificacionController.exportToExcel);

// Rutas para alumnos (separadas para no tener conflicto de roles)
router.get('/alumno/materia/:materia_id', verificarRol(['alumno']), calificacionController.getCalificacionesAlumno);
router.get('/alumno/todas', verificarRol(['alumno']), calificacionController.getAllCalificacionesAlumno);
router.delete('/alumno/materia/:materia_id/baja', verificarRol(['alumno']), calificacionController.darseDeBajaMateria);

module.exports = router;