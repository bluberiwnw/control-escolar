const pool = require('./connection');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    console.log('🗄️  Conectado a PostgreSQL. Inicializando base de datos...');

    // Crear tablas (si no existen)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profesores (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(200) NOT NULL,
        avatar VARCHAR(10) DEFAULT 'CR',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS materias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        clave VARCHAR(20) UNIQUE NOT NULL,
        horario VARCHAR(100),
        estudiantes INTEGER DEFAULT 0,
        bajas INTEGER DEFAULT 0,
        promedio DECIMAL(3,1) DEFAULT 0.0,
        semestre VARCHAR(50),
        color VARCHAR(200),
        profesor_id INTEGER REFERENCES profesores(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS estudiantes (
        id SERIAL PRIMARY KEY,
        matricula VARCHAR(20) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS actividades (
        id SERIAL PRIMARY KEY,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('tarea', 'proyecto', 'examen')),
        titulo VARCHAR(200) NOT NULL,
        descripcion TEXT,
        fecha_entrega DATE NOT NULL,
        valor INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencias (
        id SERIAL PRIMARY KEY,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
        fecha DATE NOT NULL,
        estado VARCHAR(20) DEFAULT 'presente' CHECK (estado IN ('presente', 'ausente', 'retardo')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(materia_id, estudiante_id, fecha)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS calificaciones (
        id SERIAL PRIMARY KEY,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
        actividad_id INTEGER REFERENCES actividades(id) ON DELETE SET NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('tarea', 'proyecto', 'examen')),
        calificacion DECIMAL(4,2) NOT NULL,
        fecha_registro DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS archivos_calificaciones (
        id SERIAL PRIMARY KEY,
        profesor_id INTEGER NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
        nombre_archivo VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('tarea', 'proyecto', 'examen')),
        fecha_subida DATE DEFAULT CURRENT_DATE,
        estado VARCHAR(50) DEFAULT 'Procesado',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tablas verificadas/creadas');

    // Insertar datos de prueba (si no existen)
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('profesor123', salt);

    // Profesores
    await pool.query(`
      INSERT INTO profesores (id, nombre, email, password, avatar)
      VALUES (1, 'Dr. Carlos Rodríguez', 'profesor@universidad.edu', $1, 'CR')
      ON CONFLICT (id) DO NOTHING;
    `, [hash]);
    await pool.query(`
      INSERT INTO profesores (id, nombre, email, password, avatar)
      VALUES (2, 'Dra. Ana Martínez', 'ana.martinez@universidad.edu', $1, 'AM')
      ON CONFLICT (id) DO NOTHING;
    `, [hash]);
    await pool.query(`
      INSERT INTO profesores (id, nombre, email, password, avatar)
      VALUES (3, 'Dr. Miguel Sánchez', 'miguel.sanchez@universidad.edu', $1, 'MS')
      ON CONFLICT (id) DO NOTHING;
    `, [hash]);

    // Materias
    await pool.query(`
      INSERT INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
      VALUES (1, 'Programación I', 'CS-101', 'Lun, Mié, Vie 8:00 - 10:00', 35, 2, 8.7, 'Primavera 2026', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 1)
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
      VALUES (2, 'Bases de Datos', 'CS-205', 'Mar, Jue 14:00 - 16:00', 38, 3, 8.5, 'Primavera 2026', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 1)
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
      VALUES (3, 'Algoritmos', 'CS-202', 'Lun, Mié 16:00 - 18:00', 32, 1, 7.8, 'Primavera 2026', 'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)', 1)
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
      VALUES (4, 'Redes de Computadoras', 'CS-301', 'Mar, Jue 10:00 - 12:00', 30, 2, 8.9, 'Primavera 2026', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', 2)
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
      VALUES (5, 'Inteligencia Artificial', 'CS-401', 'Vie 14:00 - 18:00', 25, 1, 9.2, 'Primavera 2026', 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)', 3)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Estudiantes
    const estudiantes = [
      [1, '2020-1234', 'Juan Carlos Pérez Gómez', 'juan.perez@estudiante.edu'],
      [2, '2020-1235', 'María Fernanda González López', 'maria.gonzalez@estudiante.edu'],
      [3, '2020-1236', 'Carlos Alberto Rodríguez Sánchez', 'carlos.rodriguez@estudiante.edu'],
      [4, '2020-1237', 'Ana Laura Martínez Hernández', 'ana.martinez@estudiante.edu'],
      [5, '2020-1238', 'Luis Miguel Torres Rivera', 'luis.torres@estudiante.edu']
    ];
    for (const e of estudiantes) {
      await pool.query(`
        INSERT INTO estudiantes (id, matricula, nombre, email)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING;
      `, e);
    }

    // Actividades (con fechas dinámicas)
    const hoy = new Date();
    const fecha1 = new Date(hoy); fecha1.setDate(hoy.getDate() + 7);
    const fecha2 = new Date(hoy); fecha2.setDate(hoy.getDate() + 14);
    const fecha3 = new Date(hoy); fecha3.setDate(hoy.getDate() + 30);
    const fecha4 = new Date(hoy); fecha4.setDate(hoy.getDate() + 21);
    const format = d => d.toISOString().split('T')[0];

    await pool.query(`
      INSERT INTO actividades (id, materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
      VALUES (1, 1, 'tarea', 'Tarea 1 - Fundamentos de Programación', 'Resolver ejercicios del capítulo 3', $1, 100)
      ON CONFLICT (id) DO NOTHING;
    `, [format(fecha1)]);
    await pool.query(`
      INSERT INTO actividades (id, materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
      VALUES (2, 1, 'examen', 'Examen Parcial - Estructuras de Control', 'Evaluación de condicionales y ciclos', $1, 100)
      ON CONFLICT (id) DO NOTHING;
    `, [format(fecha2)]);
    await pool.query(`
      INSERT INTO actividades (id, materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
      VALUES (3, 1, 'proyecto', 'Proyecto - Calculadora en Python', 'Desarrollar una calculadora con interfaz de línea de comandos', $1, 100)
      ON CONFLICT (id) DO NOTHING;
    `, [format(fecha3)]);
    await pool.query(`
      INSERT INTO actividades (id, materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
      VALUES (4, 2, 'proyecto', 'Proyecto Final - Sistema de Gestión', 'Desarrollo completo de un sistema CRUD', $1, 100)
      ON CONFLICT (id) DO NOTHING;
    `, [format(fecha4)]);

    console.log('✅ Datos de prueba insertados');
    console.log('🎉 Base de datos inicializada correctamente');

  } catch (error) {
    console.error('❌ Error durante la inicialización:', error);
  } finally {
    process.exit(0);
  }
}

initDatabase();