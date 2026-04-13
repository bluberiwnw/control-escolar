const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['administrador']));

router.get('/stats', adminController.getStats);
router.get('/usuarios', adminController.listarUsuarios);
router.post('/profesores', adminController.crearProfesor);
router.post('/estudiantes', adminController.crearEstudiante);
router.put('/profesores/:id', adminController.actualizarProfesor);
router.put('/estudiantes/:id', adminController.actualizarEstudiante);
router.delete('/usuarios/:id/:tipo', adminController.eliminarUsuario);
router.get('/materias', adminController.listarMaterias);
router.post('/materias', adminController.crearMateria);
router.put('/materias/:id', adminController.actualizarMateria);
router.delete('/materias/:id', adminController.eliminarMateria);
router.get('/actividades', adminController.listarActividades);
router.post('/actividades', adminController.crearActividad);
router.get('/actividades/:id', adminController.getActividadById);
router.put('/actividades/:id', adminController.updateActividad);
router.delete('/actividades/:id', adminController.eliminarActividad);
router.get('/asistencias', adminController.listarAsistencias);
router.get('/calificaciones', adminController.listarCalificaciones);
router.put('/calificaciones/:id', adminController.actualizarCalificacion);
router.get('/reportes', adminController.getReportes);
router.delete('/asistencias/:id', adminController.deleteAsistencia);
router.put('/asistencias/:id', adminController.actualizarAsistencia);
router.get('/calificaciones/archivos', adminController.listarArchivosCalificaciones);
router.delete('/calificaciones/archivos/:id', adminController.eliminarArchivoCalificacion);

module.exports = router;