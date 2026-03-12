const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/connection');
require('dotenv').config();

const authController = {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ message: 'Email y contraseña son requeridos' });
            }

            const result = await pool.query(
                'SELECT * FROM profesores WHERE email = $1 AND activo = true',
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ message: 'Credenciales incorrectas' });
            }

            const profesor = result.rows[0];
            const validPassword = await bcrypt.compare(password, profesor.password);

            if (!validPassword) {
                return res.status(401).json({ message: 'Credenciales incorrectas' });
            }

            const token = jwt.sign(
                { id: profesor.id, email: profesor.email, nombre: profesor.nombre },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '30d' } // valor por defecto
            );

            res.json({
                message: 'Login exitoso',
                token,
                profesor: {
                    id: profesor.id,
                    nombre: profesor.nombre,
                    email: profesor.email,
                    avatar: profesor.avatar
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getPerfil(req, res) {
        try {
            const result = await pool.query(
                'SELECT id, nombre, email, avatar, created_at FROM profesores WHERE id = $1',
                [req.profesor.id]
            );
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async cambiarPassword(req, res) {
        try {
            const { passwordActual, passwordNueva } = req.body;

            const result = await pool.query(
                'SELECT password FROM profesores WHERE id = $1',
                [req.profesor.id]
            );

            const validPassword = await bcrypt.compare(passwordActual, result.rows[0].password);
            if (!validPassword) {
                return res.status(400).json({ message: 'Contraseña actual incorrecta' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(passwordNueva, salt);

            await pool.query(
                'UPDATE profesores SET password = $1 WHERE id = $2',
                [hashedPassword, req.profesor.id]
            );

            res.json({ message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = authController;