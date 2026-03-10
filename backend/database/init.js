/*const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
    const connection = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    try {
        console.log('🗄️  Inicializando base de datos...');
        
         Leer archivo SQL
        const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        
        // Ejecutar SQL
        connection.query(sql, async (err, results) => {
            if (err) {
                console.error('❌ Error al ejecutar SQL:', err);
                process.exit(1);
            }
            
            console.log('✅ Base de datos creada exitosamente');
            
            // Actualizar contraseñas con bcrypt
            const db = mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            });
            
            // Hashear contraseñas
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('profesor123', salt);
            
            db.query(
                'UPDATE profesores SET password = ? WHERE email = ?',
                [hashedPassword, 'profesor@universidad.edu']
            );
            
            db.query(
                'UPDATE profesores SET password = ? WHERE email = ?',
                [hashedPassword, 'ana.martinez@universidad.edu']
            );
            
            db.query(
                'UPDATE profesores SET password = ? WHERE email = ?',
                [hashedPassword, 'miguel.sanchez@universidad.edu']
            );
            
            db.end();
            
            console.log('✅ Datos de prueba insertados');
            console.log('\n🎉 ¡BASE DE DATOS LISTA!');
            console.log('📊 Credenciales:');
            console.log('   Email: profesor@universidad.edu');
            console.log('   Password: profesor123');
            
            connection.end();
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

initDatabase();*/

// En init.js, reemplaza la creación de conexión con:
const pool = require('./connection'); // Usa el pool configurado

async function initDatabase() {
    try {
        // No necesitas crear la base de datos, solo úsala
        const connection = await pool.getConnection();
        console.log('🗄️  Conectado a MySQL. Inicializando base de datos...');

        // Ejecutar SQL para crear tablas (sin CREATE DATABASE)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS profesores (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(200) NOT NULL,
                avatar VARCHAR(10) DEFAULT 'CR',
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // ... resto de tablas igual, pero con IF NOT EXISTS

        // Insertar datos de prueba (con INSERT IGNORE para evitar duplicados)
        // ... etc.

        connection.release();
        console.log('✅ Base de datos inicializada');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}