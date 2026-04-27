-- Script para crear la tabla qr_logs si no existe
-- Ejecutar este script en la base de datos para solucionar errores 502/503

CREATE TABLE IF NOT EXISTS qr_logs (
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

-- Verificar que la tabla se creó correctamente
SELECT 'Tabla qr_logs creada exitosamente' as message;
