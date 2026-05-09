-- Aumentar longitud de campos en tabla estudiantes
ALTER TABLE estudiantes ALTER COLUMN matricula TYPE VARCHAR(50);
ALTER TABLE estudiantes ALTER COLUMN nombre TYPE VARCHAR(200);
ALTER TABLE estudiantes ALTER COLUMN email TYPE VARCHAR(200);
ALTER TABLE estudiantes ALTER COLUMN password TYPE VARCHAR(300);
ALTER TABLE estudiantes ALTER COLUMN rol TYPE VARCHAR(50);

-- Verificar cambios
SELECT 
    column_name, 
    data_type, 
    character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'estudiantes' 
ORDER BY ordinal_position;
