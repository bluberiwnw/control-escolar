const pool = require('./database/connection');

async function verificarConstraintSimple() {
    console.log('🔍 Verificando constraint calificaciones_tipo_check');
    
    try {
        // Verificar el constraint en la tabla calificaciones
        const constraintQuery = await pool.query(`
            SELECT conname, consrc, contype
            FROM pg_constraint 
            WHERE conrelid = 'calificaciones'::regclass 
            AND contype = 'c'
            AND conname LIKE '%tipo%'
        `);
        
        console.log('📋 Constraints encontrados:');
        constraintQuery.rows.forEach(constraint => {
            console.log(`   - ${constraint.conname} (${constraint.contype}): ${constraint.consrc}`);
        });
        
        // Verificar valores posibles para el campo tipo
        const tipoValues = await pool.query(`
            SELECT DISTINCT tipo FROM calificaciones ORDER BY tipo
        `);
        
        console.log('📊 Valores actuales en tipo:');
        tipoValues.rows.forEach(row => {
            console.log(`   - ${row.tipo}`);
        });
        
        // Verificar la definición exacta del constraint
        const checkConstraint = await pool.query(`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint 
            WHERE conrelid = 'calificaciones'::regclass 
            AND conname = 'calificaciones_tipo_check'
        `);
        
        if (checkConstraint.rows.length > 0) {
            console.log('❌ CHECK constraint encontrado:');
            console.log(`   - Definición: ${checkConstraint.rows[0].definition}`);
            
            // Extraer valores permitidos del constraint
            const constraintDef = checkConstraint.rows[0].definition;
            console.log('🔍 Analizando constraint...');
            
            // Buscar valores en el constraint
            const valoresMatch = constraintDef.match(/\(tipo = ANY \(ARRAY\[(.*?)\]\)\)/);
            if (valoresMatch) {
                const valoresPermitidos = valoresMatch[1].split(',').map(v => v.trim().replace(/'/g, ''));
                console.log('   - Valores permitidos:', valoresPermitidos);
                
                // Verificar qué valores del frontend no están en el constraint
                const valoresFrontend = ['tarea', 'examen', 'participacion', 'proyecto', 'practica', 'actividad', 'final'];
                const valoresFaltantes = valoresFrontend.filter(v => !valoresPermitidos.includes(v));
                
                if (valoresFaltantes.length > 0) {
                    console.log('❌ Valores faltantes en constraint:', valoresFaltantes);
                    console.log('🔧 Necesario agregar estos valores al constraint');
                } else {
                    console.log('✅ Todos los valores del frontend están permitidos');
                }
            }
        } else {
            console.log('✅ No hay CHECK constraint para tipo');
        }
        
    } catch (error) {
        console.error('❌ Error al verificar constraint:', error.message);
    } finally {
        await pool.end();
    }
}

verificarConstraintSimple();
