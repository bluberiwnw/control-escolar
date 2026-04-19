const express = require('express');
const router = express.Router();
const actividadController = require('../controllers/actividadController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.get('/', actividadController.getAll);
router.get('/entregas', verificarRol(['profesor']), actividadController.listarEntregasProfesor);
router.put('/entregas/:entregaId', verificarRol(['profesor']), actividadController.actualizarRetroEntrega);
router.get('/entregas/:entregaId/descarga', verificarRol(['profesor']), actividadController.descargarEntregaProfesor);
router.get('/:id', actividadController.getById);
router.post('/', actividadController.create);
router.put('/:id', actividadController.update);
router.delete('/:id', actividadController.delete);

module.exports = router;