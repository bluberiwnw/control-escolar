const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Todas las rutas requieren autenticación y rol administrador
router.use(authMiddleware);
router.use(verificarRol(['administrador']));

router.get('/stats', adminController.getStats);
router.get('/usuarios', adminController.listarUsuarios);
router.post('/usuarios/profesor', adminController.crearProfesor);
router.post('/usuarios/estudiante', adminController.crearEstudiante);
router.delete('/usuarios/:tipo/:id', adminController.eliminarUsuario);
router.get('/materias', adminController.listarMaterias);
router.delete('/materias/:id', adminController.eliminarMateria);
router.get('/actividades', adminController.listarActividades);
router.delete('/actividades/:id', adminController.eliminarActividad);
router.get('/asistencias', adminController.listarAsistencias);
router.get('/calificaciones', adminController.listarCalificaciones);
router.get('/reportes', adminController.getReportes);

module.exports = router;