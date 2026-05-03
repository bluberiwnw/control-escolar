const express = require('express');
const router = express.Router();
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['profesor', 'administrador']));
router.post('/upload', calificacionController.uploadFile);
router.get('/plantilla', calificacionController.getPlantilla);
router.get('/archivos', calificacionController.getArchivos);
router.get('/archivos/:id/descarga', calificacionController.descargarArchivoCalificacion);
router.delete('/archivos/:id', calificacionController.deleteArchivo);
router.get('/materia/:materia_id', calificacionController.getByMateria);
router.post('/', calificacionController.save);
router.get('/estadisticas/:materia_id', calificacionController.getEstadisticas);

// Nuevas rutas para CRUD de alumnos
router.get('/materia/:materia_id/alumnos', calificacionController.getAlumnosByMateria);
router.post('/alumnos', calificacionController.createAlumno);
router.put('/alumnos/:id', calificacionController.updateAlumno);
router.delete('/alumnos/:id', calificacionController.deleteAlumno);
router.get('/materia/:materia_id/exportar', calificacionController.exportToExcel);

// Rutas para el rol del alumno
router.get('/alumno/materia/:materia_id', calificacionController.getCalificacionesAlumno);
router.get('/alumno/todas', calificacionController.getAllCalificacionesAlumno);

module.exports = router;