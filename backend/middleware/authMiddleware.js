const jwt = require('jsonwebtoken');
const pool = require('../database/connection');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id, email, rol, tipo } = decoded;

        let usuario = null;

        if (tipo === 'profesor') {
            const result = await pool.query(
                'SELECT id, nombre, email, avatar, rol, activo FROM usuarios WHERE id = $1 AND email = $2',
                [id, email]
            );
            if (result.rows.length > 0) {
                usuario = result.rows[0];
                if (usuario.rol !== rol) {
                    return res.status(401).json({ message: 'Rol inválido en token' });
                }
            }
        } else if (tipo === 'alumno') {
            const result = await pool.query(
                'SELECT id, nombre, email, matricula, activo FROM estudiantes WHERE id = $1 AND email = $2',
                [id, email]
            );
            if (result.rows.length > 0) {
                usuario = result.rows[0];
                usuario.rol = 'alumno';
            }
        } else {
            return res.status(401).json({ message: 'Tipo de usuario no válido' });
        }

        if (!usuario) {
            return res.status(401).json({ message: 'Usuario no encontrado o credenciales inválidas' });
        }

        if (usuario.activo === false) {
            return res.status(401).json({ message: 'Cuenta desactivada. Contacte al administrador.' });
        }

        req.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: tipo === 'alumno' ? 'alumno' : usuario.rol,
            tipo: tipo,
            avatar: usuario.avatar || null
        };
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token inválido' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expirado' });
        }
        console.error('Error en authMiddleware:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

module.exports = authMiddleware;