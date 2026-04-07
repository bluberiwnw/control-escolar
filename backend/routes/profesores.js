const express = require('express');
const router = express.Router();
const profesorController = require('../controllers/profesorController');
const authMiddleware = require('../middleware/authMiddleware'); // ← corregido

router.use(authMiddleware);
router.get('/materias', profesorController.getMaterias);
router.get('/estadisticas', profesorController.getEstadisticas);

module.exports = router;