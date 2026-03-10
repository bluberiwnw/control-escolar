const express = require('express');
const router = express.Router();
const materiaController = require('../controllers/materiaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/', materiaController.getAll);
router.get('/:id', materiaController.getById);
router.get('/:id/estudiantes', materiaController.getEstudiantes);
router.post('/', materiaController.create);
router.put('/:id', materiaController.update);
router.delete('/:id', materiaController.delete);

module.exports = router;