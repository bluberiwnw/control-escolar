const jwt = require('jsonwebtoken');
const pool = require('../database/connection');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await pool.query(
            'SELECT id, nombre, email, avatar FROM profesores WHERE id = $1 AND activo = true',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Profesor no encontrado o inactivo' });
        }

        req.profesor = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token inválido' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expirado' });
        }
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

module.exports = authMiddleware;