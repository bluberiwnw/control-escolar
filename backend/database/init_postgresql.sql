-- Base de datos para el Sistema de Control Escolar BUAP (PostgreSQL)

-- 1. TABLA DE USUARIOS (profesores y administradores)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL,
    avatar VARCHAR(10) DEFAULT 'CR',
    rol VARCHAR(20) DEFAULT 'profesor' CHECK (rol IN ('profesor', 'administrador')),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE MATERIAS
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
    profesor_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 3. TABLA DE ESTUDIANTES
CREATE TABLE IF NOT EXISTS estudiantes (
    id SERIAL PRIMARY KEY,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(200) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    materia_id INTEGER REFERENCES materias(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DE ACTIVIDADES
CREATE TABLE IF NOT EXISTS actividades (
    id SERIAL PRIMARY KEY,
    materia_id INTEGER NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('tarea', 'proyecto', 'examen')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_entrega DATE,
    valor INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
);

-- 5. TABLA DE ARCHIVOS DE ACTIVIDADES
CREATE TABLE IF NOT EXISTS archivos_actividades (
    id SERIAL PRIMARY KEY,
    actividad_id INTEGER NOT NULL,
    profesor_id INTEGER NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 6. TABLA DE ENTREGAS DE ACTIVIDADES
CREATE TABLE IF NOT EXISTS entregas_actividades (
    id SERIAL PRIMARY KEY,
    actividad_id INTEGER NOT NULL,
    estudiante_id INTEGER NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    fecha_entrega TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calificacion DECIMAL(5,2),
    comentarios TEXT,
    FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE
);

-- 7. TABLA DE ASISTENCIA
CREATE TABLE IF NOT EXISTS asistencia (
    id SERIAL PRIMARY KEY,
    materia_id INTEGER NOT NULL,
    estudiante_id INTEGER NOT NULL,
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('presente', 'ausente', 'retardo')),
    hora_registro TIME DEFAULT CURRENT_TIME,
    qr_code VARCHAR(500),
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
    UNIQUE(materia_id, estudiante_id, fecha)
);

-- 8. TABLA DE ARCHIVOS DE CALIFICACIONES
CREATE TABLE IF NOT EXISTS archivos_calificaciones (
    id SERIAL PRIMARY KEY,
    profesor_id INTEGER NOT NULL,
    materia_id INTEGER NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('tarea', 'proyecto', 'examen', 'htm')),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesado', 'error')),
    detalles TEXT,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
);

-- 9. TABLA DE CALIFICACIONES
CREATE TABLE IF NOT EXISTS calificaciones (
    id SERIAL PRIMARY KEY,
    estudiante_id INTEGER NOT NULL,
    materia_id INTEGER NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('participacion', 'tarea', 'proyecto', 'examen', 'general')),
    calificacion DECIMAL(5,2) NOT NULL DEFAULT 0,
    calificacion_final DECIMAL(5,2) DEFAULT 0,
    porcentaje_final DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
);

-- 10. TABLA DE REPORTES
CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    profesor_id INTEGER NOT NULL,
    materia_id INTEGER NOT NULL,
    tipo_reporte VARCHAR(50) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
);

-- Insertar usuarios de ejemplo
INSERT INTO usuarios (id, nombre, email, password, avatar, rol) VALUES
(1, 'Dr. Carlos Rodríguez', 'profesor@universidad.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZJ6Jk5Iq5xQ6J5q5Q6J5q5Q6', 'CR', 'profesor'),
(2, 'Dra. Ana Martínez', 'ana.martinez@universidad.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZJ6Jk5Iq5xQ6J5q5Q6J5q5Q6', 'AM', 'profesor'),
(3, 'Dr. Miguel Sánchez', 'miguel.sanchez@universidad.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZJ6Jk5Iq5xQ6J5q5Q6J5q5Q6', 'MS', 'profesor'),
(4, 'Administrador del Sistema', 'admin@universidad.edu', '$2a$10$e0MYzXyjpJS7Pd0RVvHwfuJjA6F7sC7N7Y7y7f7g7h7i7j7k7l7', 'AD', 'administrador')
ON CONFLICT (id) DO NOTHING;

-- Insertar materias de ejemplo
INSERT INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id) VALUES
(1, 'Programación I', 'CS-101', 'Lun, Mié, Vie 8:00 - 10:00', 35, 2, 8.7, 'Primavera 2026', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 1),
(2, 'Bases de Datos', 'CS-205', 'Mar, Jue 14:00 - 16:00', 38, 3, 8.5, 'Primavera 2026', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 1),
(3, 'Algoritmos', 'CS-202', 'Lun, Mié 16:00 - 18:00', 32, 1, 7.8, 'Primavera 2026', 'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)', 1),
(4, 'Redes de Computadoras', 'CS-301', 'Mar, Jue 10:00 - 12:00', 30, 2, 8.9, 'Primavera 2026', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', 2),
(5, 'Inteligencia Artificial', 'CS-401', 'Vie 14:00 - 18:00', 25, 1, 9.2, 'Primavera 2026', 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)', 3)
ON CONFLICT (id) DO NOTHING;

-- Insertar estudiantes de ejemplo
INSERT INTO estudiantes (id, matricula, nombre, email, password, materia_id) VALUES
(1, '2020-1234', 'Juan Carlos Pérez Gómez', 'juan.perez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ', 1),
(2, '2020-1235', 'María Fernanda González López', 'maria.gonzalez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ', 1),
(3, '2020-1236', 'Carlos Alberto Rodríguez Sánchez', 'carlos.rodriguez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ', 1),
(4, '2020-1237', 'Ana Laura Martínez Hernández', 'ana.martinez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ', 2),
(5, '2020-1238', 'Luis Miguel Torres Rivera', 'luis.torres@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ', 2)
ON CONFLICT (id) DO NOTHING;

-- Insertar actividades de ejemplo
INSERT INTO actividades (materia_id, tipo, titulo, descripcion, fecha_entrega, valor) VALUES
(1, 'tarea', 'Tarea 1 - Fundamentos de Programación', 'Resolver ejercicios del capítulo 3', CURRENT_DATE + INTERVAL '7 days', 100),
(1, 'examen', 'Examen Parcial - Estructuras de Control', 'Evaluación de condicionales y ciclos', CURRENT_DATE + INTERVAL '14 days', 100),
(1, 'proyecto', 'Proyecto - Calculadora en Python', 'Desarrollar una calculadora con interfaz de línea de comandos', CURRENT_DATE + INTERVAL '30 days', 100),
(2, 'proyecto', 'Proyecto Final - Sistema de Gestión', 'Desarrollo completo de un sistema CRUD', CURRENT_DATE + INTERVAL '21 days', 100)
ON CONFLICT DO NOTHING;

-- Insertar calificaciones iniciales para los estudiantes
INSERT INTO calificaciones (estudiante_id, materia_id, tipo, calificacion) VALUES
(1, 1, 'general', 0),
(2, 1, 'general', 0),
(3, 1, 'general', 0),
(4, 2, 'general', 0),
(5, 2, 'general', 0)
ON CONFLICT DO NOTHING;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_estudiantes_materia ON estudiantes(materia_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_estudiante ON calificaciones(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_materia ON calificaciones(materia_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_actividades_materia ON actividades(materia_id);
