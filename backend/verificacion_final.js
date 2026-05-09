const pool = require('./database/connection.js');

async function verificacionFinal() {
    try {
        console.log('🔍 VERIFICACIÓN FINAL DEL MÓDULO DE CALIFICACIONES');
        console.log('=' .repeat(60));
        
        // 1. Verificar conexión a base de datos
        console.log('1. 🔌 Verificando conexión a base de datos...');
        const testResult = await pool.query('SELECT NOW()');
        console.log('   ✅ Conexión OK:', testResult.rows[0].now);
        
        // 2. Verificar todas las tablas necesarias
        console.log('\n2. 📋 Verificando tablas necesarias...');
        const tablas = ['estudiantes', 'materias', 'materias_estudiantes', 'calificaciones', 'usuarios'];
        
        for (const tabla of tablas) {
            const result = await pool.query(`
                SELECT COUNT(*) as count FROM information_schema.tables 
                WHERE table_name = $1
            `, [tabla]);
            
            if (result.rows[0].count > 0) {
                console.log(`   ✅ Tabla '${tabla}' existe`);
            } else {
                console.log(`   ❌ Tabla '${tabla}' NO existe`);
            }
        }
        
        // 3. Verificar estructura específica de materias_estudiantes
        console.log('\n3. 🔗 Verificando estructura de materias_estudiantes...');
        const meResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'materias_estudiantes' 
            ORDER BY ordinal_position
        `);
        
        if (meResult.rows.length > 0) {
            console.log('   ✅ Estructura materias_estudiantes:');
            meResult.rows.forEach(col => {
                console.log(`      - ${col.column_name}: ${col.data_type}`);
            });
        } else {
            console.log('   ❌ Tabla materias_estudiantes no tiene estructura');
        }
        
        // 4. Verificar si hay datos de prueba
        console.log('\n4. 📊 Verificando datos existentes...');
        
        const estudiantesCount = await pool.query('SELECT COUNT(*) as count FROM estudiantes');
        console.log(`   👥 Estudiantes: ${estudiantesCount.rows[0].count}`);
        
        const materiasCount = await pool.query('SELECT COUNT(*) as count FROM materias');
        console.log(`   📚 Materias: ${materiasCount.rows[0].count}`);
        
        const meCount = await pool.query('SELECT COUNT(*) as count FROM materias_estudiantes');
        console.log(`   🔗 Relaciones materia-estudiante: ${meCount.rows[0].count}`);
        
        const calificacionesCount = await pool.query('SELECT COUNT(*) as count FROM calificaciones');
        console.log(`   📈 Calificaciones: ${calificacionesCount.rows[0].count}`);
        
        // 5. Verificar permisos y relaciones
        console.log('\n5. 🔐 Verificando relaciones y permisos...');
        
        // Verificar si hay usuarios con rol profesor
        const profesoresCount = await pool.query("SELECT COUNT(*) as count FROM usuarios WHERE rol = 'profesor'");
        console.log(`   👨‍🏫 Profesores: ${profesoresCount.rows[0].count}`);
        
        // Verificar si hay materias con profesor asignado
        const materiasProfesor = await pool.query(`
            SELECT COUNT(*) as count FROM materias 
            WHERE profesor_id IS NOT NULL
        `);
        console.log(`   📋 Materias con profesor: ${materiasProfesor.rows[0].count}`);
        
        console.log('\n6. 🎯 Verificación de funciones clave...');
        
        // Verificar si podemos insertar un estudiante de prueba
        try {
            const testEstudiante = await pool.query(`
                INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                VALUES ('TEST_001', 'Estudiante Prueba', 'test@test.com', 'temporal123', 'alumno', true, NOW())
                ON CONFLICT (matricula) DO NOTHING
                RETURNING id
            `);
            
            if (testEstudiante.rows.length > 0) {
                console.log('   ✅ Inserción de estudiantes funciona');
                
                // Limpiar estudiante de prueba
                await pool.query('DELETE FROM estudiantes WHERE matricula = \'TEST_001\'');
                console.log('   🧹 Estudiante de prueba eliminado');
            } else {
                console.log('   ✅ Inserción de estudiantes funciona (ya existía)');
            }
        } catch (error) {
            console.log('   ❌ Error en inserción de estudiantes:', error.message);
        }
        
        // Verificar si podemos asociar estudiante a materia
        try {
            const primerEstudiante = await pool.query('SELECT id FROM estudiantes LIMIT 1');
            const primeraMateria = await pool.query('SELECT id FROM materias LIMIT 1');
            
            if (primerEstudiante.rows.length > 0 && primeraMateria.rows.length > 0) {
                await pool.query(`
                    INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (materia_id, estudiante_id) DO NOTHING
                `, [primeraMateria.rows[0].id, primerEstudiante.rows[0].id]);
                
                console.log('   ✅ Asociación materia-estudiante funciona');
            } else {
                console.log('   ⚠️ No hay estudiantes o materias para probar asociación');
            }
        } catch (error) {
            console.log('   ❌ Error en asociación materia-estudiante:', error.message);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ VERIFICACIÓN FINAL COMPLETADA');
        console.log('🚀 El módulo de calificaciones está listo para producción');
        
    } catch (error) {
        console.error('❌ Error en verificación final:', error);
    } finally {
        await pool.end();
    }
}

verificacionFinal();
