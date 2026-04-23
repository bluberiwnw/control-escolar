const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/reestablecer', authController.reestablecer);
router.get('/perfil', authMiddleware, authController.getPerfil);
router.put('/cambiar-password', authMiddleware, authController.cambiarPassword);
router.post('/cambiar-contrasena', authController.cambiarContrasena);

module.exports = router;