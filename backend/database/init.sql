-- Crear base de datos
DROP DATABASE IF EXISTS control_escolar_buap;
CREATE DATABASE control_escolar_buap;
USE control_escolar_buap;

-- Tabla de profesores
CREATE TABLE profesores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL,
    avatar VARCHAR(10) DEFAULT 'CR',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de materias
CREATE TABLE materias (
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

-- Tabla de estudiantes
CREATE TABLE estudiantes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de actividades
CREATE TABLE actividades (
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

-- Tabla de asistencias
CREATE TABLE asistencias (
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

-- Tabla de calificaciones
CREATE TABLE calificaciones (
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

-- Tabla de archivos de calificaciones
CREATE TABLE archivos_calificaciones (
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

-- Insertar datos de prueba
-- Profesores (contraseña: profesor123 hasheada con bcrypt)
INSERT INTO profesores (nombre, email, password, avatar) VALUES
('Dr. Carlos Rodríguez', 'profesor@universidad.edu', '$2a$10$YourHashedPasswordHere', 'CR'),
('Dra. Ana Martínez', 'ana.martinez@universidad.edu', '$2a$10$YourHashedPasswordHere', 'AM'),
('Dr. Miguel Sánchez', 'miguel.sanchez@universidad.edu', '$2a$10$YourHashedPasswordHere', 'MS');

-- Materias
INSERT INTO materias (nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id) VALUES
('Programación I', 'CS-101', 'Lun, Mié, Vie 8:00 - 10:00', 35, 2, 8.7, 'Primavera 2026', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 1),
('Bases de Datos', 'CS-205', 'Mar, Jue 14:00 - 16:00', 38, 3, 8.5, 'Primavera 2026', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 1),
('Algoritmos', 'CS-202', 'Lun, Mié 16:00 - 18:00', 32, 1, 7.8, 'Primavera 2026', 'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)', 1),
('Redes de Computadoras', 'CS-301', 'Mar, Jue 10:00 - 12:00', 30, 2, 8.9, 'Primavera 2026', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', 2),
('Inteligencia Artificial', 'CS-401', 'Vie 14:00 - 18:00', 25, 1, 9.2, 'Primavera 2026', 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)', 3);

-- Estudiantes
INSERT INTO estudiantes (matricula, nombre, email) VALUES
('2020-1234', 'Juan Carlos Pérez Gómez', 'juan.perez@estudiante.edu'),
('2020-1235', 'María Fernanda González López', 'maria.gonzalez@estudiante.edu'),
('2020-1236', 'Carlos Alberto Rodríguez Sánchez', 'carlos.rodriguez@estudiante.edu'),
('2020-1237', 'Ana Laura Martínez Hernández', 'ana.martinez@estudiante.edu'),
('2020-1238', 'Luis Miguel Torres Rivera', 'luis.torres@estudiante.edu'),
('2020-1239', 'Sofía Patricia Ramírez Castro', 'sofia.ramirez@estudiante.edu'),
('2020-1240', 'Diego Alejandro Morales Ruiz', 'diego.morales@estudiante.edu'),
('2020-1241', 'Valeria Guadalupe Herrera Soto', 'valeria.herrera@estudiante.edu'),
('2020-1242', 'Roberto Carlos Méndez Vega', 'roberto.mendez@estudiante.edu'),
('2020-1243', 'Daniela Lizeth Flores Cruz', 'daniela.flores@estudiante.edu');

-- Actividades
INSERT INTO actividades (materia_id, tipo, titulo, descripcion, fecha_entrega, valor) VALUES
(1, 'tarea', 'Tarea 1 - Fundamentos de Programación', 'Resolver ejercicios del capítulo 3', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 100),
(1, 'examen', 'Examen Parcial - Estructuras de Control', 'Evaluación de condicionales y ciclos', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 100),
(1, 'proyecto', 'Proyecto - Calculadora en Python', 'Desarrollar una calculadora con interfaz de línea de comandos', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 100),
(2, 'proyecto', 'Proyecto Final - Sistema de Gestión', 'Desarrollo completo de un sistema CRUD', DATE_ADD(CURDATE(), INTERVAL 21 DAY), 100);

-- Archivos de ejemplo
INSERT INTO archivos_calificaciones (profesor_id, materia_id, nombre_archivo, tipo, fecha_subida) VALUES
(1, 1, 'Calificaciones_Tarea1.xlsx', 'tarea', DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
(1, 1, 'Resultados_Examen_Parcial.pdf', 'examen', DATE_SUB(CURDATE(), INTERVAL 2 DAY));