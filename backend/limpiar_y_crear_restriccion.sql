-- Eliminar calificaciones duplicadas y crear restricción
-- Primero eliminar duplicados
DELETE FROM calificaciones 
WHERE ctid NOT IN (
    SELECT MIN(ctid) 
    FROM calificaciones 
    GROUP BY estudiante_id, materia_id, tipo
);

-- Luego crear la restricción UNIQUE
ALTER TABLE calificaciones 
ADD CONSTRAINT calificaciones_unique 
UNIQUE (estudiante_id, materia_id, tipo);

-- Verificar resultado
SELECT COUNT(*) as duplicados_eliminados 
FROM calificaciones 
WHERE estudiante_id IN (46, 5);
