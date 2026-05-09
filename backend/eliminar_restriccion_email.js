const pool = require('./database/connection.js');

async function eliminarRestriccionEmail() {
    try {
        console.log('🔧 Eliminando restricción UNIQUE del email...');
        
        // Eliminar la restricción UNIQUE del email
        await pool.query(`
            ALTER TABLE estudiantes 
            DROP CONSTRAINT IF EXISTS estudiantes_email_key
        `);
        
        console.log('✅ Restricción estudiantes_email_key eliminada');
        
        // Verificar que se eliminó correctamente
        const restriccionesResult = await pool.query(`
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = 'estudiantes'
                AND tc.constraint_type = 'UNIQUE'
        `);
        
        console.log('📋 Restricciones UNIQUE actuales:');
        if (restriccionesResult.rows.length > 0) {
            restriccionesResult.rows.forEach(constraint => {
                console.log(`   - ${constraint.constraint_name}: ${constraint.column_name}`);
            });
        } else {
            console.log('   ✅ No hay restricciones UNIQUE');
        }
        
        // Verificar que la matrícula sigue siendo UNIQUE
        console.log('\n🔍 Verificando restricción de matrícula...');
        const matriculaConstraint = await pool.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'estudiantes' 
                AND constraint_type = 'UNIQUE' 
                AND constraint_name = 'estudiantes_matricula_key'
        `);
        
        if (matriculaConstraint.rows.length > 0) {
            console.log('✅ Restricción de matrícula mantenida');
        } else {
            console.log('❌ Restricción de matrícula no encontrada');
        }
        
        console.log('\n🎯 Operación completada');
        console.log('✅ Ahora se pueden crear alumnos con emails duplicados');
        console.log('✅ Las matrículas siguen siendo únicas');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

eliminarRestriccionEmail();
