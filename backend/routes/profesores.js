const express = require('express');
const router = express.Router();
const profesorController = require('../controllers/profesorController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(verificarRol(['profesor', 'administrador']));
router.get('/materias', profesorController.getMaterias);
router.get('/estadisticas', profesorController.getEstadisticas);
router.get('/calificaciones-evolucion', profesorController.getEvolucionCalificaciones);

// Endpoints de asistencia para profesor
router.get('/asistencias/reporte-general', profesorController.getReporteGeneralAsistencias);
router.get('/asistencias/reporte/curso/:materia_id', profesorController.getReporteAsistenciasPorCurso);
router.get('/asistencias/exportar', profesorController.exportarAsistencias);
router.get('/asistencias/exportar/excel', profesorController.exportarAsistenciasExcel);
router.get('/asistencias/exportar/pdf', profesorController.exportarAsistenciasPDF);

module.exports = router;