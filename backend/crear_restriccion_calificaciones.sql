-- Crear restricción UNIQUE compuesta para tabla calificaciones
ALTER TABLE calificaciones 
ADD CONSTRAINT calificaciones_unique 
UNIQUE (estudiante_id, materia_id, tipo);

-- Verificar restricción creada
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'calificaciones'
    AND tc.constraint_type = 'UNIQUE'
    AND tc.constraint_name = 'calificaciones_unique';
