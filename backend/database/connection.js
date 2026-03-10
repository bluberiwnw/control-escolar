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
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    user: process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME,
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;