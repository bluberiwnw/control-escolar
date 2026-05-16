const pool = require('../database/connection');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

const fileStorage = {
    /**
     * Save an uploaded file (from multer) to both disk and PostgreSQL.
     * Returns the filename.
     */
    async guardarArchivo(multerFile) {
        if (!multerFile) return null;
        const { filename, originalname, mimetype, size } = multerFile;
        const filePath = path.join(UPLOADS_DIR, filename);
        let contenido = null;
        if (fs.existsSync(filePath)) {
            contenido = fs.readFileSync(filePath);
        }
        if (contenido) {
            await pool.query(
                `INSERT INTO archivos_almacenados (nombre_archivo, nombre_original, contenido, mime_type, tamano)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (nombre_archivo) DO UPDATE SET contenido = EXCLUDED.contenido, mime_type = EXCLUDED.mime_type, tamano = EXCLUDED.tamano`,
                [filename, originalname, contenido, mimetype, size]
            );
        }
        return filename;
    },

    /**
     * Save raw content (e.g. generated CSV, HTML) to PostgreSQL for persistent download.
     * Returns the filename.
     */
    async guardarContenido(filename, contenido, mimeType, nombreOriginal) {
        const buffer = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf-8');
        await pool.query(
            `INSERT INTO archivos_almacenados (nombre_archivo, nombre_original, contenido, mime_type, tamano)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (nombre_archivo) DO UPDATE SET contenido = EXCLUDED.contenido, mime_type = EXCLUDED.mime_type, tamano = EXCLUDED.tamano`,
            [filename, nombreOriginal || filename, buffer, mimeType, buffer.length]
        );
        return filename;
    },

    /**
     * Send a file as a download response.
     * Tries disk first, then falls back to PostgreSQL.
     */
    async enviarArchivo(res, nombreArchivo, nombreDescarga) {
        if (!nombreArchivo) {
            return res.status(404).json({ message: 'Archivo no encontrado.' });
        }

        // Try disk first
        const fullPath = path.join(UPLOADS_DIR, nombreArchivo);
        if (fs.existsSync(fullPath)) {
            return res.download(fullPath, nombreDescarga || nombreArchivo);
        }

        // Fall back to PostgreSQL
        const result = await pool.query(
            'SELECT contenido, mime_type, nombre_original FROM archivos_almacenados WHERE nombre_archivo = $1',
            [nombreArchivo]
        );
        if (result.rowCount === 0 || !result.rows[0].contenido) {
            return res.status(404).json({ message: 'El archivo ya no está en el servidor.' });
        }

        const { contenido, mime_type, nombre_original } = result.rows[0];
        const downloadName = nombreDescarga || nombre_original || nombreArchivo;

        res.setHeader('Content-Type', mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
        res.setHeader('Content-Length', contenido.length);
        return res.send(contenido);
    },

    /**
     * Delete a file from both disk and PostgreSQL.
     */
    async eliminarArchivo(nombreArchivo) {
        if (!nombreArchivo) return;
        const fullPath = path.join(UPLOADS_DIR, nombreArchivo);
        if (fs.existsSync(fullPath)) {
            try { fs.unlinkSync(fullPath); } catch (_) { /* ignore */ }
        }
        try {
            await pool.query('DELETE FROM archivos_almacenados WHERE nombre_archivo = $1', [nombreArchivo]);
        } catch (_) { /* ignore */ }
    }
};

module.exports = fileStorage;
