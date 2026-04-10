const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['administrador']));

router.get('/stats', adminController.getStats);
router.get('/usuarios', adminController.getUsuarios);
router.post('/usuarios', adminController.crearUsuario);
router.delete('/usuarios/:id', adminController.eliminarUsuario);
router.get('/materias', adminController.getMaterias);
router.delete('/materias/:id', adminController.eliminarMateria);
router.get('/actividades', adminController.getActividades);
router.delete('/actividades/:id', adminController.eliminarActividad);
router.get('/asistencias', adminController.getAsistencias);
router.get('/calificaciones', adminController.getCalificaciones);
router.get('/reportes', adminController.getReportes);

module.exports = router;