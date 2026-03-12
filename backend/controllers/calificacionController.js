const pool = require('../database/connection');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configurar multer (sin cambios)
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
    limits: { fileSize: 10 * 1024 * 1024 },
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
    async uploadFile(req, res) {
        upload(req, res, async function(err) {
            if (err) return res.status(400).json({ message: err.message });
            if (!req.file) return res.status(400).json({ message: 'No se seleccionó ningún archivo' });

            try {
                const { materia_id, tipo } = req.body;

                const materiaCheck = await pool.query(
                    'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                    [materia_id, req.profesor.id]
                );

                if (materiaCheck.rows.length === 0) {
                    fs.unlinkSync(req.file.path);
                    return res.status(404).json({ message: 'Materia no encontrada' });
                }

                const insertResult = await pool.query(
                    `INSERT INTO archivos_calificaciones (profesor_id, materia_id, nombre_archivo, tipo)
                     VALUES ($1, $2, $3, $4) RETURNING id`,
                    [req.profesor.id, materia_id, req.file.originalname, tipo]
                );

                res.json({
                    message: 'Archivo subido correctamente',
                    archivo: {
                        id: insertResult.rows[0].id,
                        nombre: req.file.originalname,
                        tipo,
                        fecha: new Date().toISOString().split('T')[0],
                        estado: 'Procesado'
                    }
                });
            } catch (error) {
                if (req.file) fs.unlinkSync(req.file.path);
                res.status(500).json({ message: 'Error en el servidor', error: error.message });
            }
        });
    },

    async getArchivos(req, res) {
        try {
            const result = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre 
                 FROM archivos_calificaciones a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.profesor_id = $1
                 ORDER BY a.fecha_subida DESC`,
                [req.profesor.id]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getByMateria(req, res) {
        try {
            const { materia_id } = req.params;

            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.profesor.id]
            );

            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }

            const result = await pool.query(
                `SELECT c.*, e.nombre, e.matricula, a.titulo as actividad_titulo
                 FROM calificaciones c
                 JOIN estudiantes e ON c.estudiante_id = e.id
                 LEFT JOIN actividades a ON c.actividad_id = a.id
                 WHERE c.materia_id = $1
                 ORDER BY e.nombre, c.tipo`,
                [materia_id]
            );

            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async save(req, res) {
        try {
            const { materia_id, estudiante_id, actividad_id, tipo, calificacion } = req.body;

            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.profesor.id]
            );

            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }

            const insertResult = await pool.query(
                `INSERT INTO calificaciones (materia_id, estudiante_id, actividad_id, tipo, calificacion)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [materia_id, estudiante_id, actividad_id || null, tipo, calificacion]
            );

            const nueva = await pool.query(
                `SELECT c.*, e.nombre, e.matricula 
                 FROM calificaciones c
                 JOIN estudiantes e ON c.estudiante_id = e.id
                 WHERE c.id = $1`,
                [insertResult.rows[0].id]
            );

            res.status(201).json(nueva.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getEstadisticas(req, res) {
        try {
            const { materia_id } = req.params;

            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.profesor.id]
            );

            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }

            const promedio = await pool.query(
                'SELECT AVG(calificacion) as promedio FROM calificaciones WHERE materia_id = $1',
                [materia_id]
            );

            const distribucion = await pool.query(
                `SELECT 
                    SUM(CASE WHEN calificacion >= 9 THEN 1 ELSE 0 END) as rango_9_10,
                    SUM(CASE WHEN calificacion >= 8 AND calificacion < 9 THEN 1 ELSE 0 END) as rango_8_9,
                    SUM(CASE WHEN calificacion >= 7 AND calificacion < 8 THEN 1 ELSE 0 END) as rango_7_8,
                    SUM(CASE WHEN calificacion >= 6 AND calificacion < 7 THEN 1 ELSE 0 END) as rango_6_7,
                    SUM(CASE WHEN calificacion < 6 THEN 1 ELSE 0 END) as rango_menor_6
                 FROM calificaciones
                 WHERE materia_id = $1`,
                [materia_id]
            );

            const porTipo = await pool.query(
                `SELECT 
                    tipo,
                    AVG(calificacion) as promedio,
                    COUNT(*) as cantidad
                 FROM calificaciones
                 WHERE materia_id = $1
                 GROUP BY tipo`,
                [materia_id]
            );

            res.json({
                promedio_general: promedio.rows[0].promedio || 0,
                distribucion: distribucion.rows[0],
                por_tipo: porTipo.rows
            });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = calificacionController;