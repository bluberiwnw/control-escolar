const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const alumnoController = require('../controllers/alumnoController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.use(authMiddleware);
router.use(verificarRol(['alumno']));

router.get('/materias', alumnoController.getMaterias);
router.get('/actividades', alumnoController.getActividades);
router.post('/entregas', upload.single('archivo'), alumnoController.subirEntrega);
router.get('/asistencias', alumnoController.getAsistencias);
router.get('/calificaciones', alumnoController.getCalificaciones);
router.get('/reportes', alumnoController.getReportes);
router.delete('/entregas/:actividad_id', alumnoController.cancelarEntrega);

module.exports = router;