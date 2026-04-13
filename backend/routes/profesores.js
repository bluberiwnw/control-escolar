const express = require('express');
const router = express.Router();
const profesorController = require('../controllers/profesorController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['profesor', 'administrador']));
router.get('/materias', profesorController.getMaterias);
router.get('/estadisticas', profesorController.getEstadisticas);
router.get('/calificaciones-evolucion', profesorController.getEvolucionCalificaciones);

module.exports = router;