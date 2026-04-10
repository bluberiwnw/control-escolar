const express = require('express');
const router = express.Router();
const alumnoController = require('../controllers/alumnoController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['alumno']));

router.get('/materias', alumnoController.getMaterias);
router.get('/actividades', alumnoController.getActividades);
router.get('/actividades/recientes', alumnoController.getActividadesRecientes);
router.post('/entregas', alumnoController.subirEntrega);
router.get('/asistencias', alumnoController.getAsistencias);
router.get('/calificaciones', alumnoController.getCalificaciones);
router.get('/reportes', alumnoController.getReportes);

module.exports = router;