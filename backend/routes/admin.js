const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['administrador']));

// Estadísticas
router.get('/stats', adminController.getStats);

// Usuarios
router.get('/usuarios', adminController.listarUsuarios);
router.post('/profesores', adminController.crearProfesor);
router.post('/estudiantes', adminController.crearEstudiante);
router.delete('/usuarios/:id/:tipo', adminController.eliminarUsuario);

// Materias
router.get('/materias', adminController.listarMaterias);
router.delete('/materias/:id', adminController.eliminarMateria);

// Actividades
router.get('/actividades', adminController.listarActividades);
router.delete('/actividades/:id', adminController.eliminarActividad);

// Asistencias y calificaciones
router.get('/asistencias', adminController.listarAsistencias);
router.get('/calificaciones', adminController.listarCalificaciones);
router.get('/reportes', adminController.getReportes);

module.exports = router;