const express = require('express');
const router = express.Router();
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.post('/upload', calificacionController.uploadFile);
router.get('/archivos', calificacionController.getArchivos);
router.get('/materia/:materia_id', calificacionController.getByMateria);
router.post('/', calificacionController.save);
router.get('/estadisticas/:materia_id', calificacionController.getEstadisticas);

module.exports = router;