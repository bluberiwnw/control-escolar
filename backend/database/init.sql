DROP DATABASE IF EXISTS control_escolar_buap;
CREATE DATABASE control_escolar_buap;
USE control_escolar_buap;

-- 1. TABLA DE PROFESORES (con rol)
CREATE TABLE profesores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL,
    avatar VARCHAR(10) DEFAULT 'CR',
    rol ENUM('administrador', 'profesor') DEFAULT 'profesor',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 2. TABLA DE MATERIAS
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

-- 3. TABLA DE ESTUDIANTES (con password y rol)
CREATE TABLE estudiantes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(200) NOT NULL,   
    rol ENUM('alumno') DEFAULT 'alumno',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DE ACTIVIDADES
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

-- 5. TABLA DE ASISTENCIAS (método tradicional)
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

-- 6. TABLA DE CALIFICACIONES (por actividad)
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

-- 7. TABLA DE ARCHIVOS DE CALIFICACIONES (subidos por profesor)
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

-- 8. NUEVA TABLA: Códigos QR para asistencia (generados por el profesor)
CREATE TABLE qr_asistencia (
    id INT PRIMARY KEY AUTO_INCREMENT,
    materia_id INT NOT NULL,
    codigo VARCHAR(100) UNIQUE NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
);

-- 9. TABLA: Logs de QR para auditoría
CREATE TABLE qr_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    qr_id INT NOT NULL,
    estudiante_id INT,
    materia_id INT NOT NULL,
    accion VARCHAR(20) NOT NULL, -- 'generado', 'escaneado', 'expirado'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (qr_id) REFERENCES qr_asistencia(id) ON DELETE CASCADE,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE SET NULL,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
);

-- 10. NUEVA TABLA: Asistencias registradas mediante QR (alumno escanea)
CREATE TABLE asistencias_qr (
    id INT PRIMARY KEY AUTO_INCREMENT,
    estudiante_id INT NOT NULL,
    qr_id INT NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
    FOREIGN KEY (qr_id) REFERENCES qr_asistencia(id) ON DELETE CASCADE,
    UNIQUE KEY unique_asistencia_qr (estudiante_id, qr_id)
);

-- 10. NUEVA TABLA: Entregas de actividades (alumno sube archivo)
CREATE TABLE entregas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    actividad_id INT NOT NULL,
    estudiante_id INT NOT NULL,
    archivo VARCHAR(255) NOT NULL,
    comentario TEXT,
    fecha_entrega TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calificacion DECIMAL(5,2) NULL,
    FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE
);

-- 11. NUEVA TABLA: Calificaciones finales por materia (promedio ponderado final)
CREATE TABLE calificaciones_finales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    materia_id INT NOT NULL,
    estudiante_id INT NOT NULL,
    calificacion DECIMAL(5,2) NOT NULL,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_final (materia_id, estudiante_id)
);

-- Insertar profesores (incluyendo un administrador)
INSERT INTO profesores (id, nombre, email, password, avatar, rol) VALUES
(1, 'Dr. Carlos Rodríguez', 'profesor@universidad.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZJ6Jk5Iq5xQ6J5q5Q6J5q5Q6', 'CR', 'profesor'),
(2, 'Dra. Ana Martínez', 'ana.martinez@universidad.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZJ6Jk5Iq5xQ6J5q5Q6J5q5Q6', 'AM', 'profesor'),
(3, 'Dr. Miguel Sánchez', 'miguel.sanchez@universidad.edu', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZJ6Jk5Iq5xQ6J5q5Q6J5q5Q6', 'MS', 'profesor'),
(4, 'Administrador del Sistema', 'admin@universidad.edu', '$2a$10$e0MYzXyjpJS7Pd0RVvHwfuJjA6F7sC7N7Y7y7f7g7h7i7j7k7l7', 'AD', 'administrador');

-- Insertar materias (asociadas a profesores)
INSERT INTO materias (id, nombre, clave, horario, estudiantes, bajas, promedio, semestre, color, profesor_id) VALUES
(1, 'Programación I', 'CS-101', 'Lun, Mié, Vie 8:00 - 10:00', 35, 2, 8.7, 'Primavera 2026', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 1),
(2, 'Bases de Datos', 'CS-205', 'Mar, Jue 14:00 - 16:00', 38, 3, 8.5, 'Primavera 2026', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 1),
(3, 'Algoritmos', 'CS-202', 'Lun, Mié 16:00 - 18:00', 32, 1, 7.8, 'Primavera 2026', 'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)', 1),
(4, 'Redes de Computadoras', 'CS-301', 'Mar, Jue 10:00 - 12:00', 30, 2, 8.9, 'Primavera 2026', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', 2),
(5, 'Inteligencia Artificial', 'CS-401', 'Vie 14:00 - 18:00', 25, 1, 9.2, 'Primavera 2026', 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)', 3);

-- Insertar estudiantes (con contraseña 'alumno123' hasheada)
INSERT INTO estudiantes (id, matricula, nombre, email, password) VALUES
(1, '2020-1234', 'Juan Carlos Pérez Gómez', 'juan.perez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(2, '2020-1235', 'María Fernanda González López', 'maria.gonzalez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(3, '2020-1236', 'Carlos Alberto Rodríguez Sánchez', 'carlos.rodriguez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(4, '2020-1237', 'Ana Laura Martínez Hernández', 'ana.martinez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(5, '2020-1238', 'Luis Miguel Torres Rivera', 'luis.torres@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(6, '2020-1239', 'Sofía Patricia Ramírez Castro', 'sofia.ramirez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(7, '2020-1240', 'Diego Alejandro Morales Ruiz', 'diego.morales@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(8, '2020-1241', 'Valeria Guadalupe Herrera Soto', 'valeria.herrera@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(9, '2020-1242', 'Roberto Carlos Méndez Vega', 'roberto.mendez@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ'),
(10, '2020-1243', 'Daniela Lizeth Flores Cruz', 'daniela.flores@estudiante.edu', '$2a$10$TtUq8eJjQ1X1X1X1X1X1XuABCDEFGHIJKLMNOPQRSTUVWXYZ');

-- Insertar actividades (fechas dinámicas usando DATE_ADD)
INSERT INTO actividades (id, materia_id, tipo, titulo, descripcion, fecha_entrega, valor) VALUES
(1, 1, 'tarea', 'Tarea 1 - Fundamentos de Programación', 'Resolver ejercicios del capítulo 3', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 100),
(2, 1, 'examen', 'Examen Parcial - Estructuras de Control', 'Evaluación de condicionales y ciclos', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 100),
(3, 1, 'proyecto', 'Proyecto - Calculadora en Python', 'Desarrollar una calculadora con interfaz de línea de comandos', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 100),
(4, 2, 'proyecto', 'Proyecto Final - Sistema de Gestión', 'Desarrollo completo de un sistema CRUD', DATE_ADD(CURDATE(), INTERVAL 21 DAY), 100);

-- Insertar archivos de calificaciones de ejemplo
INSERT INTO archivos_calificaciones (profesor_id, materia_id, nombre_archivo, tipo, fecha_subida) VALUES
(1, 1, 'Calificaciones_Tarea1.xlsx', 'tarea', DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
(1, 1, 'Resultados_Examen_Parcial.pdf', 'examen', DATE_SUB(CURDATE(), INTERVAL 2 DAY));

-- Insertar algunos registros de asistencias tradicionales para pruebas
INSERT INTO asistencias (materia_id, estudiante_id, fecha, estado) VALUES
(1, 1, CURDATE(), 'presente'),
(1, 2, CURDATE(), 'presente'),
(1, 3, CURDATE(), 'ausente');

-- Insertar un código QR de ejemplo (para pruebas)
INSERT INTO qr_asistencia (materia_id, codigo, fecha, hora_inicio, hora_fin) VALUES
(1, 'qr_ejemplo_123', CURDATE(), '08:00:00', '10:00:00');
