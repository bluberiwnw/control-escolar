const { Pool } = require('pg');

let pool;

if (process.env.DATABASE_URL) {
  // En producción (Render), usamos la URL de conexión
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Necesario para conexiones seguras de Render
    }
  });
  console.log('Conectado a PostgreSQL mediante DATABASE_URL');
} else {
  // Desarrollo local: usamos variables separadas
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'control_escolar_buap',
    port: process.env.DB_PORT || 5432,
  });
  console.log('Usando configuración local para PostgreSQL');
}

module.exports = pool;