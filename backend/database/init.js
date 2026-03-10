const mysql = require('mysql2');
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
        
        // Leer archivo SQL
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

initDatabase();