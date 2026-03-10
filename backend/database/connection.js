/*const mysql = require('mysql2');
require('dotenv').config();

Crear pool de conexiones
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Promisify para usar async/await
const promisePool = pool.promise();

module.exports = promisePool;*/

const mysql = require('mysql2/promise');

let pool;
if (process.env.MYSQL_URL) {
    // Usar la URL pública con SSL
    pool = mysql.createPool({
        uri: process.env.MYSQL_URL,
        ssl: {
            rejectUnauthorized: false // Aceptar certificados autofirmados
        },
        connectTimeout: 60000,
        acquireTimeout: 60000
    });
    console.log('✅ Usando MYSQL_URL pública con SSL');
} else {
    // Fallback local
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'control_escolar_buap',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('ℹ️ Usando configuración local');
}

module.exports = pool;