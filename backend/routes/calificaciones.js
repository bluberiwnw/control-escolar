const express = require('express');
const router = express.Router();
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['profesor', 'administrador']));
router.post('/upload', calificacionController.uploadFile);
router.get('/plantilla', calificacionController.getPlantilla);
router.get('/archivos', calificacionController.getArchivos);
router.get('/archivos/:id/descarga', calificacionController.descargarArchivoCalificacion);
router.delete('/archivos/:id', calificacionController.deleteArchivo);
router.get('/materia/:materia_id', calificacionController.getByMateria);
router.post('/', calificacionController.save);
router.get('/estadisticas/:materia_id', calificacionController.getEstadisticas);

module.exports = router;