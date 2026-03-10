const jwt = require('jsonwebtoken');
const pool = require('../database/connection');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
    try {
        // Obtener token del header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado' });
        }
        
        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Buscar profesor en la base de datos
        const [profesores] = await pool.query(
            'SELECT id, nombre, email, avatar FROM profesores WHERE id = ? AND activo = true',
            [decoded.id]
        );
        
        if (profesores.length === 0) {
            return res.status(401).json({ message: 'Profesor no encontrado o inactivo' });
        }
        
        // Agregar profesor al request
        req.profesor = profesores[0];
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