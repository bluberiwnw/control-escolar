-- Script para actualizar el esquema de la base de datos
-- Agregar columnas faltantes a la tabla calificaciones si no existen

-- Verificar si la columna calificacion_final existe, si no, agregarla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='calificaciones' 
        AND column_name='calificacion_final'
    ) THEN
        ALTER TABLE calificaciones ADD COLUMN calificacion_final DECIMAL(5,2) DEFAULT 0;
        RAISE NOTICE 'Columna calificacion_final agregada a la tabla calificaciones';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='calificaciones' 
        AND column_name='porcentaje_final'
    ) THEN
        ALTER TABLE calificaciones ADD COLUMN porcentaje_final DECIMAL(5,2) DEFAULT 0;
        RAISE NOTICE 'Columna porcentaje_final agregada a la tabla calificaciones';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='calificaciones' 
        AND column_name='updated_at'
    ) THEN
        ALTER TABLE calificaciones ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Columna updated_at agregada a la tabla calificaciones';
    END IF;
END $$;

-- Actualizar calificaciones existentes con valores por defecto
UPDATE calificaciones 
SET calificacion_final = calificacion, 
    porcentaje_final = CASE 
        WHEN calificacion >= 9 THEN 100
        WHEN calificacion >= 8 THEN 90
        WHEN calificacion >= 7 THEN 80
        WHEN calificacion >= 6 THEN 70
        ELSE 60
    END
WHERE calificacion_final = 0 AND calificacion > 0;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_calificaciones_estudiante_materia ON calificaciones(estudiante_id, materia_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_materia ON calificaciones(materia_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_tipo ON calificaciones(tipo);

-- Actualizar timestamps para registros existentes
UPDATE calificaciones SET updated_at = created_at WHERE updated_at IS NULL;
