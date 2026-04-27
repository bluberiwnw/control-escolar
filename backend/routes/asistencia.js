const express = require('express');
const router = express.Router();
const asistenciaController = require('../controllers/asistenciaController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['profesor', 'administrador']));
router.get('/:materia_id/:fecha', asistenciaController.getByMateriaYFecha);
router.post('/', asistenciaController.save);
router.post('/batch', asistenciaController.saveBatch);
router.get('/estadisticas/:materia_id', asistenciaController.getEstadisticas);
router.get('/historial/:materia_id', asistenciaController.getHistorialCompleto);

module.exports = router;