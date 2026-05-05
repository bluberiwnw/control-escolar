const express = require('express');
const router = express.Router();
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Rutas para profesores y administradores
router.use(verificarRol(['profesor', 'administrador']));
router.post('/upload', calificacionController.uploadFile);
router.get('/plantilla', calificacionController.getPlantilla);
router.get('/archivos', calificacionController.getArchivos);
router.get('/archivos/:id/descarga', calificacionController.descargarArchivoCalificacion);
router.delete('/archivos/:id', calificacionController.deleteArchivo);
router.get('/materia/:materia_id', calificacionController.getByMateria);
router.post('/', calificacionController.save);
router.get('/estadisticas/:materia_id', calificacionController.getEstadisticas);

// Rutas para CRUD de alumnos (solo profesores)
router.get('/materia/:materia_id/alumnos', calificacionController.getAlumnosByMateria);
router.post('/alumnos', calificacionController.createAlumno);
router.put('/alumnos/:id', calificacionController.updateAlumno);
router.delete('/alumnos/:id', calificacionController.deleteAlumno);
router.get('/materia/:materia_id/exportar', calificacionController.exportToExcel);

// Rutas para alumnos (separadas para no tener conflicto de roles)
router.use('/alumno', verificarRol(['alumno']));
router.get('/alumno/materia/:materia_id', calificacionController.getCalificacionesAlumno);
router.get('/alumno/todas', calificacionController.getAllCalificacionesAlumno);
router.delete('/alumno/materia/:materia_id/baja', calificacionController.darseDeBajaMateria);

module.exports = router;