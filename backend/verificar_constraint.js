const pool = require('./database/connection');

async function verificarConstraint() {
    console.log('🔍 Verificando constraint calificaciones_tipo_check');
    
    try {
        // Verificar el constraint en la tabla calificaciones
        const constraintQuery = await pool.query(`
            SELECT conname, consrc 
            FROM pg_constraint 
            WHERE conrelid = 'calificaciones'::regclass 
            AND contype = 'c'
            AND conname LIKE '%tipo%'
        `);
        
        console.log('📋 Constraints encontrados:');
        constraintQuery.rows.forEach(constraint => {
            console.log(`   - ${constraint.conname}: ${constraint.consrc}`);
        });
        
        // Verificar valores posibles para el campo tipo
        const tipoValues = await pool.query(`
            SELECT DISTINCT tipo FROM calificaciones ORDER BY tipo
        `);
        
        console.log('📊 Valores actuales en tipo:');
        tipoValues.rows.forEach(row => {
            console.log(`   - ${row.tipo}`);
        });
        
        // Verificar si hay un CHECK constraint
        const checkConstraint = await pool.query(`
            SELECT conname, consrc 
            FROM pg_constraint 
            WHERE conrelid = 'calificaciones'::regclass 
            AND contype = 'c'
            AND conname = 'calificaciones_tipo_check'
        `);
        
        if (checkConstraint.rows.length > 0) {
            console.log('❌ CHECK constraint encontrado:');
            console.log(`   - ${checkConstraint.rows[0].conname}: ${checkConstraint.rows[0].consrc}`);
            
            // Analizar qué valores permite el constraint
            const constraintDef = checkConstraint.rows[0].consrc;
            console.log('🔍 Análisis del constraint:');
            console.log(`   - Definición: ${constraintDef}`);
            
            // Extraer valores permitidos del constraint
            const valoresMatch = constraintDef.match(/\(tipo = ANY \(ARRAY\[(.*?)\]\)\)/);
            if (valoresMatch) {
                const valoresPermitidos = valoresMatch[1].split(',').map(v => v.trim().replace(/'/g, ''));
                console.log('   - Valores permitidos:', valoresPermitidos);
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

verificarConstraint();
