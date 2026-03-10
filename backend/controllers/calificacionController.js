const pool = require('../database/connection');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo Excel y PDF'), false);
        }
    }
}).single('archivo');

const calificacionController = {
    // Subir archivo de calificaciones
    async uploadFile(req, res) {
        upload(req, res, async function(err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            
            if (!req.file) {
                return res.status(400).json({ message: 'No se seleccionó ningún archivo' });
            }
            
            try {
                const { materia_id, tipo } = req.body;
                
                // Verificar que la materia pertenece al profesor
                const [materias] = await pool.query(
                    'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                    [materia_id, req.profesor.id]
                );
                
                if (materias.length === 0) {
                    // Eliminar archivo subido
                    fs.unlinkSync(req.file.path);
                    return res.status(404).json({ message: 'Materia no encontrada' });
                }
                
                // Guardar registro en la base de datos
                const [result] = await pool.query(
                    `INSERT INTO archivos_calificaciones 
                     (profesor_id, materia_id, nombre_archivo, tipo) 
                     VALUES (?, ?, ?, ?)`,
                    [req.profesor.id, materia_id, req.file.originalname, tipo]
                );
                
                res.json({
                    message: 'Archivo subido correctamente',
                    archivo: {
                        id: result.insertId,
                        nombre: req.file.originalname,
                        tipo,
                        fecha: new Date().toISOString().split('T')[0],
                        estado: 'Procesado'
                    }
                });
                
            } catch (error) {
                // Eliminar archivo si hay error
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }
                res.status(500).json({ message: 'Error en el servidor', error: error.message });
            }
        });
    },
    
    // Obtener historial de archivos subidos
    async getArchivos(req, res) {
        try {
            const [archivos] = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre 
                 FROM archivos_calificaciones a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.profesor_id = ?
                 ORDER BY a.fecha_subida DESC`,
                [req.profesor.id]
            );
            
            res.json(archivos);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Obtener calificaciones de una materia
    async getByMateria(req, res) {
        try {
            const { materia_id } = req.params;
            
            // Verificar que la materia pertenece al profesor
            const [materias] = await pool.query(
                'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                [materia_id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            const [calificaciones] = await pool.query(
                `SELECT c.*, e.nombre, e.matricula, a.titulo as actividad_titulo
                 FROM calificaciones c
                 JOIN estudiantes e ON c.estudiante_id = e.id
                 LEFT JOIN actividades a ON c.actividad_id = a.id
                 WHERE c.materia_id = ?
                 ORDER BY e.nombre, c.tipo`,
                [materia_id]
            );
            
            res.json(calificaciones);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Guardar una calificación
    async save(req, res) {
        try {
            const { materia_id, estudiante_id, actividad_id, tipo, calificacion } = req.body;
            
            // Verificar que la materia pertenece al profesor
            const [materias] = await pool.query(
                'SELECT id FROM materias WHERE id = ? AND profesor_id = ?',
                [materia_id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            const [result] = await pool.query(
                `INSERT INTO calificaciones 
                 (materia_id, estudiante_id, actividad_id, tipo, calificacion) 
                 VALUES (?, ?, ?, ?, ?)`,
                [materia_id, estudiante_id, actividad_id || null, tipo, calificacion]
            );
            
            const [nueva] = await pool.query(
                `SELECT c.*, e.nombre, e.matricula 
                 FROM calificaciones c
                 JOIN estudiantes e ON c.estudiante_id = e.id
                 WHERE c.id = ?`,
                [result.insertId]
            );
            
            res.status(201).json(nueva[0]);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Obtener estadísticas de calificaciones
    async getEstadisticas(req, res) {
        try {
            const { materia_id } = req.params;
            
            // Verificar que la materia pertenece al profesor
            const [materias] = await pool.query(
                'SELECT id, estudiantes FROM materias WHERE id = ? AND profesor_id = ?',
                [materia_id, req.profesor.id]
            );
            
            if (materias.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            
            // Promedio general
            const [promedio] = await pool.query(
                'SELECT AVG(calificacion) as promedio FROM calificaciones WHERE materia_id = ?',
                [materia_id]
            );
            
            // Distribución
            const [distribucion] = await pool.query(
                `SELECT 
                    SUM(CASE WHEN calificacion >= 9 THEN 1 ELSE 0 END) as rango_9_10,
                    SUM(CASE WHEN calificacion >= 8 AND calificacion < 9 THEN 1 ELSE 0 END) as rango_8_9,
                    SUM(CASE WHEN calificacion >= 7 AND calificacion < 8 THEN 1 ELSE 0 END) as rango_7_8,
                    SUM(CASE WHEN calificacion >= 6 AND calificacion < 7 THEN 1 ELSE 0 END) as rango_6_7,
                    SUM(CASE WHEN calificacion < 6 THEN 1 ELSE 0 END) as rango_menor_6
                 FROM calificaciones
                 WHERE materia_id = ?`,
                [materia_id]
            );
            
            // Por tipo
            const [porTipo] = await pool.query(
                `SELECT 
                    tipo,
                    AVG(calificacion) as promedio,
                    COUNT(*) as cantidad
                 FROM calificaciones
                 WHERE materia_id = ?
                 GROUP BY tipo`,
                [materia_id]
            );
            
            res.json({
                promedio_general: promedio[0].promedio || 0,
                distribucion: distribucion[0],
                por_tipo: porTipo
            });
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = calificacionController;