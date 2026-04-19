const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`);
    },
});

const uploadEntrega = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (['.pdf', '.doc', '.docx', '.zip'].includes(ext)) return cb(null, true);
        cb(new Error('Tipo de archivo no permitido. Usa PDF, DOC, DOCX o ZIP.'));
    },
});

router.use(authMiddleware);
router.use(verificarRol(['administrador']));

router.get('/stats', adminController.getStats);
router.get('/usuarios', adminController.listarUsuarios);
router.post('/profesores', adminController.crearProfesor);
router.post('/estudiantes', adminController.crearEstudiante);
router.put('/profesores/:id', adminController.actualizarProfesor);
router.put('/estudiantes/:id', adminController.actualizarEstudiante);
router.delete('/usuarios/:id/:tipo', adminController.eliminarUsuario);
router.get('/materias', adminController.listarMaterias);
router.post('/materias', adminController.crearMateria);
router.put('/materias/:id', adminController.actualizarMateria);
router.delete('/materias/:id', adminController.eliminarMateria);
router.get('/actividades', adminController.listarActividades);
router.post('/actividades', adminController.crearActividad);
router.get('/actividades/:id', adminController.getActividadById);
router.put('/actividades/:id', adminController.updateActividad);
router.delete('/actividades/:id', adminController.eliminarActividad);
router.get('/asistencias', adminController.listarAsistencias);
router.get('/calificaciones', adminController.listarCalificaciones);
router.put('/calificaciones/:id', adminController.actualizarCalificacion);
router.delete('/calificaciones/:id', adminController.eliminarCalificacion);
router.get('/reportes', adminController.getReportes);
router.delete('/asistencias/:id', adminController.deleteAsistencia);
router.put('/asistencias/:id', adminController.actualizarAsistencia);
router.get('/calificaciones/archivos', adminController.listarArchivosCalificaciones);
router.get('/calificaciones/archivos/:id/descarga', adminController.descargarArchivoCalificacionAdmin);
router.delete('/calificaciones/archivos/:id', adminController.eliminarArchivoCalificacion);
router.get('/entregas/archivos', adminController.listarArchivosEntregas);
router.get('/entregas/archivos/:id/descarga', adminController.descargarArchivoEntrega);
router.put('/entregas/archivos/:id', uploadEntrega.single('archivo'), adminController.actualizarArchivoEntrega);
router.delete('/entregas/archivos/:id', adminController.eliminarArchivoEntrega);

module.exports = router;