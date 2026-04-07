const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const verificarRol = require('../middleware/roleMiddleware');

router.use(authMiddleware, verificarRol(['administrador']));
router.get('/usuarios', adminController.listarUsuarios);
router.post('/usuarios', adminController.crearUsuario);
router.put('/usuarios/:tipo/:id/toggle', adminController.toggleActivo);

module.exports = router;