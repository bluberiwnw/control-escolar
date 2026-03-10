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
if (process.env.MYSQL_PRIVATE_URL) {
    pool = mysql.createPool(process.env.MYSQL_PRIVATE_URL);
} else if (process.env.MYSQL_PUBLIC_URL) {
    console.warn('Usando conexión pública (puede incurrir en costos)');
    pool = mysql.createPool(process.env.MYSQL_PUBLIC_URL);
} else if (process.env.MYSQL_URL) {
    pool = mysql.createPool(process.env.MYSQL_URL);
} else {
    // fallback para desarrollo local
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'control_escolar_buap',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}

module.exports = pool;