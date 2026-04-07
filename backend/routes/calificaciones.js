const express = require('express');
const router = express.Router();
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.post('/upload', calificacionController.uploadFile);
router.get('/archivos', calificacionController.getArchivos);
router.get('/finales/:materia_id', calificacionController.getCalificacionesFinales);

module.exports = router;