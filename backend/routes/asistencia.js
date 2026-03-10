const express = require('express');
const router = express.Router();
const asistenciaController = require('../controllers/asistenciaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/:materia_id/:fecha', asistenciaController.getByMateriaYFecha);
router.post('/', asistenciaController.save);
router.post('/batch', asistenciaController.saveBatch);
router.get('/estadisticas/:materia_id', asistenciaController.getEstadisticas);

module.exports = router;