const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware'); // Ruta correcta

// Rutas públicas
router.post('/login', authController.login);

// Rutas protegidas
router.get('/perfil', authMiddleware, authController.getPerfil);
router.put('/cambiar-password', authMiddleware, authController.cambiarPassword);

module.exports = router;