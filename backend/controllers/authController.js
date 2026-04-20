const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/connection');
require('dotenv').config();

const authController = {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            console.log('🔐 Intento de login para:', email);
            
            if (!email || !password) {
                console.log('❌ Email o contraseña vacíos');
                return res.status(400).json({ message: 'Email y contraseña son requeridos' });
            }

            // Buscar en usuarios
            let result = await pool.query(
                `SELECT id, nombre, email, password, avatar, rol, activo, 'profesor' as tipo 
                 FROM usuarios WHERE email = $1`,
                [email]
            );
            let usuario = result.rows[0];
            console.log('🔍 Búsqueda en usuarios:', usuario ? 'Encontrado' : 'No encontrado');

            if (!usuario) {
                result = await pool.query(
                    `SELECT id, nombre, email, password, NULL as avatar, 'alumno' as rol, activo, 'alumno' as tipo 
                     FROM estudiantes WHERE email = $1`,
                    [email]
                );
                usuario = result.rows[0];
                console.log('🔍 Búsqueda en estudiantes:', usuario ? 'Encontrado' : 'No encontrado');
            }

            if (!usuario) {
                console.log('❌ Usuario no existe en ninguna tabla');
                return res.status(401).json({ message: 'Credenciales incorrectas' });
            }

            console.log('📋 Usuario encontrado:', usuario.email, 'Rol:', usuario.rol, 'Activo:', usuario.activo);
            console.log('🔑 Hash almacenado (primeros 20):', usuario.password.substring(0, 20));

            if (usuario.activo === false) {
                console.log('❌ Cuenta desactivada');
                return res.status(401).json({ message: 'Cuenta desactivada. Contacte al administrador.' });
            }

            console.log('🔄 Comparando contraseña...');
            const validPassword = await bcrypt.compare(password, usuario.password);
            console.log('✅ Resultado bcrypt.compare:', validPassword);

            if (!validPassword) {
                console.log('❌ Contraseña incorrecta');
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

            console.log('✅ Login exitoso para:', email);
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
            console.error('🔥 Error en login:', error);
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
    },

    async reestablecer(req, res) {
        try {
            const { email } = req.body;
            console.log('🔐 Solicitud de reestablecer contraseña para:', email);

            if (!email) {
                return res.status(400).json({ message: 'Email es requerido' });
            }

            // Buscar en usuarios
            let result = await pool.query(
                `SELECT id, nombre, email, 'profesor' as tipo FROM usuarios WHERE email = $1`,
                [email]
            );
            let usuario = result.rows[0];

            // Si no encuentra en usuarios, buscar en estudiantes
            if (!usuario) {
                result = await pool.query(
                    `SELECT id, nombre, email, 'alumno' as tipo FROM estudiantes WHERE email = $1`,
                    [email]
                );
                usuario = result.rows[0];
            }

            if (!usuario) {
                console.log('❌ Email no encontrado en ninguna tabla');
                return res.status(404).json({ message: 'No existe una cuenta con ese email' });
            }

            // Generar token temporal para reestablecer (válido por 1 hora)
            const resetToken = jwt.sign(
                { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Generar contraseña temporal (simplificado para demo)
            const tempPassword = Math.random().toString(36).slice(-8);
            const salt = await bcrypt.genSalt(10);
            const hashedTempPassword = await bcrypt.hash(tempPassword, salt);

            // Actualizar contraseña con la temporal
            const table = usuario.tipo === 'profesor' ? 'usuarios' : 'estudiantes';
            await pool.query(
                `UPDATE ${table} SET password = $1 WHERE id = $2`,
                [hashedTempPassword, usuario.id]
            );

            console.log('✅ Contraseña temporal generada para:', email);
            console.log('🔑 Contraseña temporal:', tempPassword);

            // En producción, aquí se enviaría email
            res.json({ 
                message: 'Se ha enviado una contraseña temporal a tu correo',
                // Solo para desarrollo/depuración
                debug: {
                    tempPassword: tempPassword,
                    resetToken: resetToken
                }
            });

        } catch (error) {
            console.error('🔥 Error en reestablecer contraseña:', error);
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
};

module.exports = authController;