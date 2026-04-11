const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.post('/generar', authMiddleware, verificarRol(['profesor', 'administrador']), qrController.generarQR);
router.post('/validar', authMiddleware, verificarRol(['alumno']), qrController.registrarAsistenciaQR);

module.exports = router;