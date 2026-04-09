const express = require('express');
const router = express.Router();
const alumnoController = require('../controllers/alumnoController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/entregas');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.use(authMiddleware);
router.use(verificarRol(['alumno']));

router.get('/materias', alumnoController.getMaterias);
router.get('/actividades', alumnoController.getActividades);
router.post('/entregas', upload.single('archivo'), alumnoController.subirEntrega);
router.get('/calificaciones', alumnoController.getCalificaciones);
router.get('/asistencias', alumnoController.getAsistencias);
router.get('/reportes', alumnoController.getReportes);

module.exports = router;