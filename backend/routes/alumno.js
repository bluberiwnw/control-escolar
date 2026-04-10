const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const alumnoController = require('../controllers/alumnoController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.use(authMiddleware);
router.use(verificarRol(['alumno']));

router.get('/materias', alumnoController.getMaterias);
router.get('/actividades', alumnoController.getActividades);  // ← usa getActividades, no getActividadesRecientes
router.post('/entregas', upload.single('archivo'), alumnoController.subirEntrega);
router.get('/asistencias', alumnoController.getAsistencias);
router.get('/calificaciones', alumnoController.getCalificaciones);
router.get('/reportes', alumnoController.getReportes);

module.exports = router;