CREATE TABLE IF NOT EXISTS qr_logs (
    id SERIAL PRIMARY KEY,
    qr_id INT NOT NULL,
    estudiante_id INT,
    materia_id INT NOT NULL,
    accion VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);
