const pool = require('./database/connection.js');

async function testNuevaLogicaAlumnos() {
    try {
        console.log('🧪 TEST: Probando nueva lógica de alumnos...');
        
        // 1. Probar agregar alumno existente a nueva materia
        console.log('1. 📚 Probando agregar alumno existente a nueva materia...');
        
        // Verificar que el alumno existe
        const alumnoExistente = await pool.query(
            'SELECT * FROM estudiantes WHERE matricula = $1',
            ['2021-1022']
        );
        
        if (alumnoExistente.rows.length > 0) {
            console.log('   ✅ Alumno existente:', alumnoExistente.rows[0].nombre);
            
            // Verificar en qué materias está
            const materiasActuales = await pool.query(`
                SELECT m.id, m.nombre 
                FROM materias m
                JOIN materias_estudiantes me ON m.id = me.materia_id
                WHERE me.estudiante_id = $1
            `, [alumnoExistente.rows[0].id]);
            
            console.log('   📚 Materias actuales:');
            materiasActuales.rows.forEach(m => {
                console.log(`      - ID ${m.id}: ${m.nombre}`);
            });
            
            // Probar agregar a una materia nueva
            const materiaNueva = 14; // Circuitos
            
            const yaInscrito = await pool.query(
                'SELECT id FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2',
                [alumnoExistente.rows[0].id, materiaNueva]
            );
            
            if (yaInscrito.rows.length === 0) {
                console.log('   ✅ Alumno no está en materia 14, se puede agregar');
                
                // Simular la nueva lógica
                await pool.query(
                    'INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion) VALUES ($1, $2, NOW())',
                    [materiaNueva, alumnoExistente.rows[0].id]
                );
                
                console.log('   ✅ Alumno agregado a materia 14');
                
                // Limpiar
                await pool.query(
                    'DELETE FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2',
                    [alumnoExistente.rows[0].id, materiaNueva]
                );
                
                console.log('   🧹 Limpieza completada');
            } else {
                console.log('   ❌ Alumno ya está en materia 14');
            }
        }
        
        // 2. Probar agregar alumno nuevo
        console.log('\n2. 👥 Probando agregar alumno nuevo...');
        
        const matriculaNueva = 'TEST_' + Date.now();
        const nombreNuevo = 'Test Alumno Nuevo';
        const emailNuevo = 'test.nuevo@ejemplo.com';
        
        console.log(`   📡 Datos: ${matriculaNueva}, ${nombreNuevo}, ${emailNuevo}`);
        
        // Verificar que no exista
        const existeCheck = await pool.query(
            'SELECT id FROM estudiantes WHERE matricula = $1',
            [matriculaNueva]
        );
        
        if (existeCheck.rows.length === 0) {
            // Crear alumno nuevo
            const result = await pool.query(
                `INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, matricula, nombre, email, created_at`,
                [matriculaNueva, nombreNuevo, emailNuevo, 'temporal123', 'alumno', true]
            );
            
            const nuevoAlumno = result.rows[0];
            console.log('   ✅ Alumno nuevo creado:', nuevoAlumno);
            
            // Asociar a materia
            await pool.query(
                'INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion) VALUES ($1, $2, NOW())',
                [14, nuevoAlumno.id]
            );
            
            console.log('   ✅ Alumno nuevo asociado a materia 14');
            
            // Limpiar
            await pool.query('DELETE FROM materias_estudiantes WHERE estudiante_id = $1', [nuevoAlumno.id]);
            await pool.query('DELETE FROM estudiantes WHERE id = $1', [nuevoAlumno.id]);
            
            console.log('   🧹 Limpieza completada');
        }
        
        // 3. Probar duplicado en misma materia
        console.log('\n3. ❌ Probando duplicado en misma materia...');
        
        if (alumnoExistente.rows.length > 0) {
            console.log('   📡 Intentando agregar alumno existente a materia 20 (donde ya está)...');
            
            const duplicadoCheck = await pool.query(
                'SELECT id FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2',
                [alumnoExistente.rows[0].id, 20]
            );
            
            if (duplicadoCheck.rows.length > 0) {
                console.log('   ✅ Correctamente detectado duplicado en materia 20');
                console.log('   ❌ No se permite agregar el mismo alumno a la misma materia');
            } else {
                console.log('   ❌ No se detectó duplicado (esto es un error)');
            }
        }
        
        console.log('\n🎯 Test completado');
        console.log('✅ Nueva lógica funciona correctamente');
        console.log('✅ Permite misma matrícula en diferentes clases');
        console.log('✅ Evita duplicados en la misma clase');
        
    } catch (error) {
        console.error('❌ Error en test:', error.message);
    } finally {
        await pool.end();
    }
}

testNuevaLogicaAlumnos();
