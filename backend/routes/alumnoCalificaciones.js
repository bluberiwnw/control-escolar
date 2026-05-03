const express = require('express');
const router = express.Router();
const calificacionController = require('../controllers/calificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['alumno']));

// Rutas exclusivas para el rol del alumno
router.get('/materia/:materia_id', calificacionController.getCalificacionesAlumno);
router.get('/todas', calificacionController.getAllCalificacionesAlumno);

module.exports = router;
