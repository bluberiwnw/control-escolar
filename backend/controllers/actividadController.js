const pool = require('../database/connection');
const fs = require('fs');
const path = require('path');

function parseEnteroEntrega(v, fallback = NaN) {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
}

const actividadController = {
    async getAll(req, res) {
        try {
            const { materia_id } = req.query;
            let query = `
                SELECT a.*, m.nombre as materia_nombre, m.color 
                FROM actividades a
                JOIN materias m ON a.materia_id = m.id
                WHERE m.profesor_id = $1
            `;
            const params = [req.usuario.id];
            let paramIndex = 2;
            if (materia_id) {
                query += ` AND a.materia_id = $${paramIndex}`;
                params.push(materia_id);
                paramIndex++;
            }
            query += ' ORDER BY a.fecha_entrega';
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getById(req, res) {
        try {
            const { id } = req.params;
            const result = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1 AND m.profesor_id = $2`,
                [id, req.usuario.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async create(req, res) {
        try {
            const { materia_id, tipo, titulo, descripcion, fecha_entrega, valor } = req.body;
            const materiaCheck = await pool.query(
                'SELECT id FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, req.usuario.id]
            );
            if (materiaCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Materia no encontrada' });
            }
            const insertResult = await pool.query(
                `INSERT INTO actividades (materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [materia_id, tipo, titulo, descripcion, fecha_entrega, valor || 100]
            );
            const nuevaActividad = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1`,
                [insertResult.rows[0].id]
            );
            res.status(201).json(nuevaActividad.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async update(req, res) {
        try {
            const { id } = req.params;
            const { tipo, titulo, descripcion, fecha_entrega, valor } = req.body;
            const check = await pool.query(
                `SELECT a.id FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1 AND m.profesor_id = $2`,
                [id, req.usuario.id]
            );
            if (check.rows.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }
            await pool.query(
                `UPDATE actividades 
                 SET tipo = $1, titulo = $2, descripcion = $3, fecha_entrega = $4, valor = $5
                 WHERE id = $6`,
                [tipo, titulo, descripcion, fecha_entrega, valor, id]
            );
            const actividadActualizada = await pool.query(
                `SELECT a.*, m.nombre as materia_nombre, m.color 
                 FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1`,
                [id]
            );
            res.json(actividadActualizada.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async delete(req, res) {
        try {
            const { id } = req.params;
            const check = await pool.query(
                `SELECT a.id FROM actividades a
                 JOIN materias m ON a.materia_id = m.id
                 WHERE a.id = $1 AND m.profesor_id = $2`,
                [id, req.usuario.id]
            );
            if (check.rows.length === 0) {
                return res.status(404).json({ message: 'Actividad no encontrada' });
            }
            await pool.query('DELETE FROM actividades WHERE id = $1', [id]);
            res.json({ message: 'Actividad eliminada correctamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async listarEntregasProfesor(req, res) {
        try {
            const { materia_id } = req.query;
            const params = [req.usuario.id];
            let idx = 2;
            let query = `
                SELECT e.id, e.archivo, e.comentario, e.calificacion, e.actividad_id, e.estudiante_id,
                       a.titulo AS actividad_titulo, a.materia_id, a.valor AS actividad_valor,
                       m.nombre AS materia_nombre, s.nombre AS estudiante_nombre
                FROM entregas e
                JOIN actividades a ON e.actividad_id = a.id
                JOIN materias m ON a.materia_id = m.id
                JOIN estudiantes s ON e.estudiante_id = s.id
                WHERE m.profesor_id = $1
            `;
            if (materia_id) {
                query += ` AND a.materia_id = $${idx}`;
                params.push(parseEnteroEntrega(materia_id, 0));
                idx++;
            }
            query += ' ORDER BY a.titulo, s.nombre';
            const result = await pool.query(query, params);
            res.json(
                result.rows.map((row) => ({
                    ...row,
                    archivo_url: row.archivo ? `/uploads/${encodeURIComponent(row.archivo)}` : null,
                }))
            );
        } catch (error) {
            res.status(500).json({ message: 'No se pudieron cargar las entregas.', error: error.message });
        }
    },

    async actualizarRetroEntrega(req, res) {
        try {
            const entregaId = parseEnteroEntrega(req.params.entregaId, NaN);
            if (!Number.isInteger(entregaId) || entregaId <= 0) {
                return res.status(400).json({ message: 'ID de entrega no válido.' });
            }
            const comentario = String(req.body?.comentario || '').trim().slice(0, 500);
            const body = req.body || {};
            const hasCalifKey = Object.prototype.hasOwnProperty.call(body, 'calificacion');
            let calificacionValor = null;
            if (hasCalifKey) {
                const raw = String(body.calificacion ?? '').trim();
                if (raw !== '') {
                    const n = Number.parseFloat(raw);
                    if (Number.isNaN(n)) {
                        return res.status(400).json({ message: 'Calificación no válida.' });
                    }
                    calificacionValor = Math.min(100, Math.max(0, n));
                }
            }
            const check = await pool.query(
                `SELECT e.id FROM entregas e
                 JOIN actividades a ON e.actividad_id = a.id
                 JOIN materias m ON a.materia_id = m.id
                 WHERE e.id = $1 AND m.profesor_id = $2`,
                [entregaId, req.usuario.id]
            );
            if (check.rowCount === 0) {
                return res.status(404).json({ message: 'Entrega no encontrada.' });
            }
            if (hasCalifKey) {
                await pool.query('UPDATE entregas SET comentario = $1, calificacion = $2 WHERE id = $3', [
                    comentario,
                    calificacionValor,
                    entregaId,
                ]);
            } else {
                await pool.query('UPDATE entregas SET comentario = $1 WHERE id = $2', [comentario, entregaId]);
            }
            res.json({ message: 'Retroalimentación guardada correctamente.' });
        } catch (error) {
            res.status(500).json({ message: 'No se pudo guardar la retroalimentación.', error: error.message });
        }
    },

    async descargarEntregaProfesor(req, res) {
        try {
            const entregaId = parseEnteroEntrega(req.params.entregaId, NaN);
            if (!Number.isInteger(entregaId) || entregaId <= 0) {
                return res.status(400).json({ message: 'ID de entrega no válido.' });
            }
            const find = await pool.query(
                `SELECT e.archivo FROM entregas e
                 JOIN actividades a ON e.actividad_id = a.id
                 JOIN materias m ON a.materia_id = m.id
                 WHERE e.id = $1 AND m.profesor_id = $2`,
                [entregaId, req.usuario.id]
            );
            if (find.rowCount === 0 || !find.rows[0].archivo) {
                return res.status(404).json({ message: 'Archivo no encontrado.' });
            }
            const archivo = find.rows[0].archivo;
            const full = path.join(__dirname, '../uploads', archivo);
            if (!fs.existsSync(full)) {
                return res.status(404).json({ message: 'El archivo ya no está en el servidor.' });
            }
            return res.download(full, archivo);
        } catch (error) {
            res.status(500).json({ message: 'No se pudo descargar el archivo.' });
        }
    },
};

module.exports = actividadController;