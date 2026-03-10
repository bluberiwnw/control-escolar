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
const pool = require('./connection');
const bcrypt = require('bcryptjs');

async function initDatabase() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('🗄️  Conectado a MySQL. Inicializando base de datos...');

        // Crear tablas (si no existen)
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

        await connection.query(`
            CREATE TABLE IF NOT EXISTS materias (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nombre VARCHAR(100) NOT NULL,
                clave VARCHAR(20) UNIQUE NOT NULL,
                horario VARCHAR(100),
                estudiantes INT DEFAULT 0,
                bajas INT DEFAULT 0,
                promedio DECIMAL(3,1) DEFAULT 0.0,
                semestre VARCHAR(50),
                color VARCHAR(200),
                profesor_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS estudiantes (
                id INT PRIMARY KEY AUTO_INCREMENT,
                matricula VARCHAR(20) UNIQUE NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS actividades (
                id INT PRIMARY KEY AUTO_INCREMENT,
                materia_id INT NOT NULL,
                tipo ENUM('tarea', 'proyecto', 'examen') NOT NULL,
                titulo VARCHAR(200) NOT NULL,
                descripcion TEXT,
                fecha_entrega DATE NOT NULL,
                valor INT DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS asistencias (
                id INT PRIMARY KEY AUTO_INCREMENT,
                materia_id INT NOT NULL,
                estudiante_id INT NOT NULL,
                fecha DATE NOT NULL,
                estado ENUM('presente', 'ausente', 'retardo') DEFAULT 'presente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
                FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
                UNIQUE KEY unique_asistencia (materia_id, estudiante_id, fecha)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS calificaciones (
                id INT PRIMARY KEY AUTO_INCREMENT,
                materia_id INT NOT NULL,
                estudiante_id INT NOT NULL,
                actividad_id INT,
                tipo ENUM('tarea', 'proyecto', 'examen') NOT NULL,
                calificacion DECIMAL(4,2) NOT NULL,
                fecha_registro DATE DEFAULT (CURRENT_DATE),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
                FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
                FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE SET NULL
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS archivos_calificaciones (
                id INT PRIMARY KEY AUTO_INCREMENT,
                profesor_id INT NOT NULL,
                materia_id INT NOT NULL,
                nombre_archivo VARCHAR(255) NOT NULL,
                tipo ENUM('tarea', 'proyecto', 'examen') NOT NULL,
                fecha_subida DATE DEFAULT (CURRENT_DATE),
                estado VARCHAR(50) DEFAULT 'Procesado',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE,
                FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
            );
        `);

        console.log('✅ Tablas verificadas/creadas');

        // Insertar datos de prueba (si no existen)
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('profesor123', salt);

        // Profesores
        await connection.query(`
            INSERT IGNORE INTO profesores (id, nombre, email, password, avatar) VALUES
            (1, 'Dr. Carlos Rodríguez', 'profesor@universidad.edu', ?, 'CR'),
            (2, 'Dra. Ana Martínez', 'ana.martinez@universidad.edu', ?, 'AM'),
            (3, 'Dr. Miguel Sánchez', 'miguel.sanchez@universidad.edu', ?, 'MS')
        `, [hash, hash, hash]);

        // Materias
        await connection.query(`
            INSERT IGNORE INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id) VALUES
            (1, 'Programación I', 'CS-101', 'Lun, Mié, Vie 8:00 - 10:00', 35, 2, 8.7, 'Primavera 2026', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 1),
            (2, 'Bases de Datos', 'CS-205', 'Mar, Jue 14:00 - 16:00', 38, 3, 8.5, 'Primavera 2026', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 1),
            (3, 'Algoritmos', 'CS-202', 'Lun, Mié 16:00 - 18:00', 32, 1, 7.8, 'Primavera 2026', 'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)', 1),
            (4, 'Redes de Computadoras', 'CS-301', 'Mar, Jue 10:00 - 12:00', 30, 2, 8.9, 'Primavera 2026', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', 2),
            (5, 'Inteligencia Artificial', 'CS-401', 'Vie 14:00 - 18:00', 25, 1, 9.2, 'Primavera 2026', 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)', 3)
        `);

        // Estudiantes
        await connection.query(`
            INSERT IGNORE INTO estudiantes (id, matricula, nombre, email) VALUES
            (1, '2020-1234', 'Juan Carlos Pérez Gómez', 'juan.perez@estudiante.edu'),
            (2, '2020-1235', 'María Fernanda González López', 'maria.gonzalez@estudiante.edu'),
            (3, '2020-1236', 'Carlos Alberto Rodríguez Sánchez', 'carlos.rodriguez@estudiante.edu'),
            (4, '2020-1237', 'Ana Laura Martínez Hernández', 'ana.martinez@estudiante.edu'),
            (5, '2020-1238', 'Luis Miguel Torres Rivera', 'luis.torres@estudiante.edu')
        `);

        // Actividades (con fechas dinámicas)
        const hoy = new Date();
        const fecha1 = new Date(hoy); fecha1.setDate(hoy.getDate() + 7);
        const fecha2 = new Date(hoy); fecha2.setDate(hoy.getDate() + 14);
        const fecha3 = new Date(hoy); fecha3.setDate(hoy.getDate() + 30);
        const fecha4 = new Date(hoy); fecha4.setDate(hoy.getDate() + 21);
        const format = d => d.toISOString().split('T')[0];

        await connection.query(`
            INSERT IGNORE INTO actividades (id, materia_id, tipo, titulo, descripcion, fecha_entrega, valor) VALUES
            (1, 1, 'tarea', 'Tarea 1 - Fundamentos de Programación', 'Resolver ejercicios del capítulo 3', ?, 100),
            (2, 1, 'examen', 'Examen Parcial - Estructuras de Control', 'Evaluación de condicionales y ciclos', ?, 100),
            (3, 1, 'proyecto', 'Proyecto - Calculadora en Python', 'Desarrollar una calculadora con interfaz de línea de comandos', ?, 100),
            (4, 2, 'proyecto', 'Proyecto Final - Sistema de Gestión', 'Desarrollo completo de un sistema CRUD', ?, 100)
        `, [format(fecha1), format(fecha2), format(fecha3), format(fecha4)]);

        console.log('✅ Datos de prueba insertados');
        console.log('🎉 Base de datos inicializada correctamente');

    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);
    } finally {
        if (connection) connection.release();
        // No cerramos el pool porque podría ser usado después, pero aquí terminamos
        process.exit(0); // Salida exitosa
    }
}

initDatabase();