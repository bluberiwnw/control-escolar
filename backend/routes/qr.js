const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/roleMiddleware');

router.post('/generar', authMiddleware, verificarRol(['profesor', 'administrador']), qrController.generarQR);
router.post('/validar', authMiddleware, verificarRol(['alumno']), qrController.registrarAsistenciaQR);

module.exports = router;