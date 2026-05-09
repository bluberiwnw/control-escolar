const pool = require('./database/connection.js');

async function verificarEmailsDuplicados() {
    try {
        console.log('🔍 Verificando emails duplicados en tabla estudiantes...');
        
        // Verificar si hay emails duplicados
        const duplicadosResult = await pool.query(`
            SELECT email, COUNT(*) as count 
            FROM estudiantes 
            WHERE email IS NOT NULL 
            GROUP BY email 
            HAVING COUNT(*) > 1
        `);
        
        if (duplicadosResult.rows.length > 0) {
            console.log('❌ Emails duplicados encontrados:');
            duplicadosResult.rows.forEach(row => {
                console.log(`   - ${row.email}: ${row.count} veces`);
            });
            
            // Verificar el email específico que causa el problema
            const emailProblema = await pool.query(`
                SELECT matricula, nombre, email, created_at 
                FROM estudiantes 
                WHERE email = $1 
                ORDER BY created_at DESC
            `, ['juan.perez@estudiante.edu']);
            
            if (emailProblema.rows.length > 0) {
                console.log('\n📋 Estudiantes con email juan.perez@estudiante.edu:');
                emailProblema.rows.forEach(est => {
                    console.log(`   - ${est.matricula}: ${est.nombre} (${est.email})`);
                });
            }
        } else {
            console.log('✅ No hay emails duplicados');
        }
        
        // Verificar restricciones en la tabla
        console.log('\n🔍 Verificando restricciones de tabla estudiantes...');
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
        
        if (restriccionesResult.rows.length > 0) {
            console.log('📋 Restricciones UNIQUE encontradas:');
            restriccionesResult.rows.forEach(constraint => {
                console.log(`   - ${constraint.constraint_name}: ${constraint.column_name}`);
            });
        } else {
            console.log('✅ No hay restricciones UNIQUE');
        }
        
        console.log('\n🎯 Solución propuesta:');
        console.log('1. Eliminar restricción UNIQUE del email o permitir emails duplicados');
        console.log('2. Modificar createAlumno para manejar emails duplicados');
        console.log('3. Agregar validación de email único en el frontend');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

verificarEmailsDuplicados();
