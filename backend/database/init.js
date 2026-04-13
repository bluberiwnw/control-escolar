const pool = require('./connection');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    console.log('🗄️  Inicializando base de datos...');

    // 1. Tabla usuarios (profesores y administradores)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(200) NOT NULL,
        avatar VARCHAR(10) DEFAULT 'CR',
        rol VARCHAR(20) DEFAULT 'profesor' CHECK (rol IN ('administrador', 'profesor')),
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tabla estudiantes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS estudiantes (
        id SERIAL PRIMARY KEY,
        matricula VARCHAR(20) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        password VARCHAR(200) NOT NULL,
        rol VARCHAR(20) DEFAULT 'alumno' CHECK (rol IN ('alumno')),
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Tabla materias
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
        profesor_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Tabla actividades
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

    // 5. Tabla asistencias (tradicional)
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

    // 6. Tabla calificaciones (por actividad)
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

    // 7. Tabla archivos_calificaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS archivos_calificaciones (
        id SERIAL PRIMARY KEY,
        profesor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
        nombre_archivo VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('tarea', 'proyecto', 'examen')),
        fecha_subida DATE DEFAULT CURRENT_DATE,
        estado VARCHAR(50) DEFAULT 'Procesado',
        detalles TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Tabla qr_asistencia
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qr_asistencia (
        id SERIAL PRIMARY KEY,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
        codigo VARCHAR(100) UNIQUE NOT NULL,
        fecha DATE NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fin TIME NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Tabla asistencias_qr
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencias_qr (
        id SERIAL PRIMARY KEY,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
        qr_id INTEGER NOT NULL REFERENCES qr_asistencia(id) ON DELETE CASCADE,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(estudiante_id, qr_id)
      );
    `);

    // 10. Tabla entregas (alumnos suben archivos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entregas (
        id SERIAL PRIMARY KEY,
        actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
        archivo VARCHAR(255) NOT NULL,
        comentario TEXT,
        fecha_entrega TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        calificacion DECIMAL(5,2)
      );
    `);

    // 11. Tabla calificaciones_finales (promedio final por materia)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calificaciones_finales (
        id SERIAL PRIMARY KEY,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
        calificacion DECIMAL(5,2) NOT NULL,
        UNIQUE(materia_id, estudiante_id)
      );
    `);

    // 12. Inscripciones alumno–materia
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inscripciones (
        id SERIAL PRIMARY KEY,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
        estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
        UNIQUE(materia_id, estudiante_id)
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS entregas_actividad_estudiante_uq
      ON entregas(actividad_id, estudiante_id);
    `);

    console.log('✅ Tablas creadas/verificadas');

    // Insertar datos de prueba
    const salt = await bcrypt.genSalt(10);
    const hashProfesor = await bcrypt.hash('profesor123', salt);
    const hashAdmin = await bcrypt.hash('admin123', salt);
    const hashAlumno = await bcrypt.hash('alumno123', salt);

    // Usuarios (profesores y admin)
    await pool.query(`
      INSERT INTO usuarios (id, nombre, email, password, avatar, rol)
      VALUES 
        (1, 'Dr. Carlos Rodríguez', 'profesor@universidad.edu', $1, 'CR', 'profesor'),
        (2, 'Dra. Ana Martínez', 'ana.martinez@universidad.edu', $1, 'AM', 'profesor'),
        (3, 'Dr. Miguel Sánchez', 'miguel.sanchez@universidad.edu', $1, 'MS', 'profesor')
      ON CONFLICT (id) DO NOTHING;
    `, [hashProfesor]);
    await pool.query(`
      INSERT INTO usuarios (nombre, email, password, rol)
      VALUES ('Administrador del Sistema', 'admin@universidad.edu', $1, 'administrador')
      ON CONFLICT (email) DO NOTHING;
    `, [hashAdmin]);

    // Estudiantes (con contraseña alumno123)
    const estudiantesData = [
      [1, '2020-1234', 'Juan Carlos Pérez Gómez', 'juan.perez@estudiante.edu'],
      [2, '2020-1235', 'María Fernanda González López', 'maria.gonzalez@estudiante.edu'],
      [3, '2020-1236', 'Carlos Alberto Rodríguez Sánchez', 'carlos.rodriguez@estudiante.edu'],
      [4, '2020-1237', 'Ana Laura Martínez Hernández', 'ana.martinez@estudiante.edu'],
      [5, '2020-1238', 'Luis Miguel Torres Rivera', 'luis.torres@estudiante.edu']
    ];
    for (const e of estudiantesData) {
      await pool.query(`
        INSERT INTO estudiantes (id, matricula, nombre, email, password)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING;
      `, [e[0], e[1], e[2], e[3], hashAlumno]);
    }

    // Materias (asociadas a profesores)
    await pool.query(`
      INSERT INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id)
      VALUES 
        (1, 'Programación I', 'CS-101', 'Lun, Mié, Vie 8:00 - 10:00', 35, 2, 8.7, 'Primavera 2026', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 1),
        (2, 'Bases de Datos', 'CS-205', 'Mar, Jue 14:00 - 16:00', 38, 3, 8.5, 'Primavera 2026', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 1),
        (3, 'Algoritmos', 'CS-202', 'Lun, Mié 16:00 - 18:00', 32, 1, 7.8, 'Primavera 2026', 'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)', 1),
        (4, 'Redes de Computadoras', 'CS-301', 'Mar, Jue 10:00 - 12:00', 30, 2, 8.9, 'Primavera 2026', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', 2),
        (5, 'Inteligencia Artificial', 'CS-401', 'Vie 14:00 - 18:00', 25, 1, 9.2, 'Primavera 2026', 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)', 3)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Actividades con fechas dinámicas
    const hoy = new Date();
    const f1 = new Date(hoy); f1.setDate(hoy.getDate()+7);
    const f2 = new Date(hoy); f2.setDate(hoy.getDate()+14);
    const f3 = new Date(hoy); f3.setDate(hoy.getDate()+30);
    const f4 = new Date(hoy); f4.setDate(hoy.getDate()+21);
    const format = d => d.toISOString().split('T')[0];
    await pool.query(`
      INSERT INTO actividades (id, materia_id, tipo, titulo, descripcion, fecha_entrega, valor)
      VALUES 
        (1, 1, 'tarea', 'Tarea 1 - Fundamentos de Programación', 'Resolver ejercicios del capítulo 3', $1, 100),
        (2, 1, 'examen', 'Examen Parcial - Estructuras de Control', 'Evaluación de condicionales y ciclos', $2, 100),
        (3, 1, 'proyecto', 'Proyecto - Calculadora en Python', 'Desarrollar una calculadora con interfaz de línea de comandos', $3, 100),
        (4, 2, 'proyecto', 'Proyecto Final - Sistema de Gestión', 'Desarrollo completo de un sistema CRUD', $4, 100)
      ON CONFLICT (id) DO NOTHING;
    `, [format(f1), format(f2), format(f3), format(f4)]);

    // Inscripciones de ejemplo (alumnos 1–5 en materias 1, 2 y 3)
    for (const mid of [1, 2, 3]) {
      for (let sid = 1; sid <= 5; sid++) {
        await pool.query(
          `INSERT INTO inscripciones (materia_id, estudiante_id) VALUES ($1, $2)
           ON CONFLICT (materia_id, estudiante_id) DO NOTHING`,
          [mid, sid]
        );
      }
    }

    console.log('✅ Datos de prueba insertados');
    console.log('🎉 Base de datos inicializada correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

initDatabase();