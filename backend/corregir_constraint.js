const pool = require('./database/connection');

async function corregirConstraint() {
    console.log('🔧 Corrigiendo constraint calificaciones_tipo_check');
    
    try {
        // Primero, eliminar el constraint existente
        console.log('🗑️ Eliminando constraint existente...');
        await pool.query('ALTER TABLE calificaciones DROP CONSTRAINT IF EXISTS calificaciones_tipo_check');
        console.log('✅ Constraint eliminado');
        
        // Luego, crear un nuevo constraint con todos los valores necesarios
        console.log('🔧 Creando nuevo constraint con valores actualizados...');
        await pool.query(`
            ALTER TABLE calificaciones 
            ADD CONSTRAINT calificaciones_tipo_check 
            CHECK (tipo IN ('tarea', 'examen', 'participacion', 'proyecto', 'practica', 'actividad', 'final', 'general'))
        `);
        console.log('✅ Nuevo constraint creado');
        
        // Verificar el constraint creado
        const constraintQuery = await pool.query(`
            SELECT conname, consrc 
            FROM pg_constraint 
            WHERE conrelid = 'calificaciones'::regclass 
            AND contype = 'c'
            AND conname = 'calificaciones_tipo_check'
        `);
        
        if (constraintQuery.rows.length > 0) {
            console.log('✅ Constraint verificado:');
            console.log(`   - ${constraintQuery.rows[0].conname}: ${constraintQuery.rows[0].consrc}`);
        }
        
        // Verificar valores actuales
        const tipoValues = await pool.query(`
            SELECT DISTINCT tipo FROM calificaciones ORDER BY tipo
        `);
        
        console.log('📊 Valores actuales en tipo:');
        tipoValues.rows.forEach(row => {
            console.log(`   - ${row.tipo}`);
        });
        
        console.log('✅ Constraint corregido exitosamente');
        console.log('🎋 Ahora los endpoints deberían funcionar sin errores 500');
        
    } catch (error) {
        console.error('❌ Error al corregir constraint:', error.message);
        console.error('🔍 Stack trace:', error.stack);
    } finally {
        await pool.end();
    }
}

corregirConstraint();
