const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/connection');
require('dotenv').config();

const authController = {
    // Login de profesor
    async login(req, res) {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ message: 'Email y contraseña son requeridos' });
            }
            
            // Buscar profesor por email
            const [profesores] = await pool.query(
                'SELECT * FROM profesores WHERE email = ? AND activo = true',
                [email]
            );
            
            if (profesores.length === 0) {
                return res.status(401).json({ message: 'Credenciales incorrectas' });
            }
            
            const profesor = profesores[0];
            
            // Verificar contraseña
            const validPassword = await bcrypt.compare(password, profesor.password);
            
            if (!validPassword) {
                return res.status(401).json({ message: 'Credenciales incorrectas' });
            }
            
            // Generar token
            const token = jwt.sign(
                { 
                    id: profesor.id,
                    email: profesor.email,
                    nombre: profesor.nombre
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE }
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
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Obtener perfil del profesor
    async getPerfil(req, res) {
        try {
            const [profesores] = await pool.query(
                'SELECT id, nombre, email, avatar, created_at FROM profesores WHERE id = ?',
                [req.profesor.id]
            );
            
            res.json(profesores[0]);
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },
    
    // Cambiar contraseña
    async cambiarPassword(req, res) {
        try {
            const { passwordActual, passwordNueva } = req.body;
            
            // Obtener profesor con contraseña actual
            const [profesores] = await pool.query(
                'SELECT password FROM profesores WHERE id = ?',
                [req.profesor.id]
            );
            
            const validPassword = await bcrypt.compare(passwordActual, profesores[0].password);
            
            if (!validPassword) {
                return res.status(400).json({ message: 'Contraseña actual incorrecta' });
            }
            
            // Hashear nueva contraseña
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(passwordNueva, salt);
            
            // Actualizar contraseña
            await pool.query(
                'UPDATE profesores SET password = ? WHERE id = ?',
                [hashedPassword, req.profesor.id]
            );
            
            res.json({ message: 'Contraseña actualizada correctamente' });
            
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = authController;