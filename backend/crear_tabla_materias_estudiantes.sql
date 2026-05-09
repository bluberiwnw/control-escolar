-- Crear tabla para asociar estudiantes con materias
CREATE TABLE IF NOT EXISTS materias_estudiantes (
    id SERIAL PRIMARY KEY,
    materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    estudiante_id INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(materia_id, estudiante_id)
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_materias_estudiantes_materia ON materias_estudiantes(materia_id);
CREATE INDEX IF NOT EXISTS idx_materias_estudiantes_estudiante ON materias_estudiantes(estudiante_id);
