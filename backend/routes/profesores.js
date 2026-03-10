const express = require('express');
const router = express.Router();
const profesorController = require('../controllers/profesorController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/materias', profesorController.getMaterias);
router.get('/estadisticas', profesorController.getEstadisticas);

module.exports = router;