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

            // Buscar en usuarios (incluye profesores y administradores)
            let result = await pool.query(
                `SELECT id, nombre, email, password, avatar, rol, activo, 'profesor' as tipo 
                 FROM usuarios WHERE email = $1`,
                [email]
            );
            let usuario = result.rows[0];

            // Si no está en usuarios, buscar en estudiantes
            if (!usuario) {
                result = await pool.query(
                    `SELECT id, nombre, email, password, NULL as avatar, 'alumno' as rol, activo, 'alumno' as tipo 
                     FROM estudiantes WHERE email = $1`,
                    [email]
                );
                usuario = result.rows[0];
            }

            if (!usuario) {
                return res.status(401).json({ message: 'Credenciales incorrectas' });
            }

            if (usuario.activo === false) {
                return res.status(401).json({ message: 'Cuenta desactivada. Contacte al administrador.' });
            }

            const validPassword = await bcrypt.compare(password, usuario.password);
            if (!validPassword) {
                return res.status(401).json({ message: 'Credenciales incorrectas' });
            }

            const token = jwt.sign(
                {
                    id: usuario.id,
                    email: usuario.email,
                    nombre: usuario.nombre,
                    rol: usuario.rol,
                    tipo: usuario.tipo
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '30d' }
            );

            res.json({
                message: 'Login exitoso',
                token,
                usuario: {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    email: usuario.email,
                    avatar: usuario.avatar || null,
                    rol: usuario.rol,
                    tipo: usuario.tipo
                }
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async getPerfil(req, res) {
        try {
            const { id, tipo } = req.usuario;
            let query = '';
            if (tipo === 'profesor') {
                query = 'SELECT id, nombre, email, avatar, rol, created_at FROM usuarios WHERE id = $1';
            } else {
                query = 'SELECT id, nombre, email, matricula, created_at FROM estudiantes WHERE id = $1';
            }
            const result = await pool.query(query, [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    async cambiarPassword(req, res) {
        try {
            const { passwordActual, passwordNueva } = req.body;
            const { id, tipo } = req.usuario;

            let table = tipo === 'profesor' ? 'usuarios' : 'estudiantes';
            const result = await pool.query(`SELECT password FROM ${table} WHERE id = $1`, [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            const validPassword = await bcrypt.compare(passwordActual, result.rows[0].password);
            if (!validPassword) {
                return res.status(400).json({ message: 'Contraseña actual incorrecta' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(passwordNueva, salt);

            await pool.query(`UPDATE ${table} SET password = $1 WHERE id = $2`, [hashedPassword, id]);

            res.json({ message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = authController;