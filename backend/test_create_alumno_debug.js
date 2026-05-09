const pool = require('./database/connection.js');

async function testCreateAlumnoDebug() {
    try {
        console.log('🧪 TEST: Depurando createAlumno...');
        
        // 1. Simular exactamente lo que envía el frontend
        console.log('1. 📡 Simulando petición createAlumno...');
        
        const testAlumnoData = {
            materia_id: '3',
            matricula: '2021-1022',
            nombre: 'Juan Carlos Perez Gomez',
            email: 'juan.perez@estudiante.edu'
        };
        
        console.log('   📡 Datos que enviaría el frontend:', testAlumnoData);
        
        // 2. Verificar validación como lo haría el backend
        console.log('\n2. 🔍 Verificando validación...');
        
        if (!testAlumnoData.materia_id || !testAlumnoData.matricula || !testAlumnoData.nombre) {
            console.log('   ❌ Validación fallida');
        } else {
            console.log('   ✅ Validación exitosa');
        }
        
        // 3. Verificar si la matrícula ya existe
        console.log('\n3. 🔍 Verificando matrícula única...');
        
        const matriculaCheck = await pool.query(
            'SELECT id FROM estudiantes WHERE matricula = $1',
            [testAlumnoData.matricula.trim()]
        );
        
        if (matriculaCheck.rows.length > 0) {
            console.log('   ❌ Matrícula ya existe');
        } else {
            console.log('   ✅ Matrícula disponible');
        }
        
        // 4. Verificar si la materia existe
        console.log('\n4. 📚 Verificando materia...');
        
        const materiaCheck = await pool.query(
            'SELECT id, nombre FROM materias WHERE id = $1',
            [testAlumnoData.materia_id]
        );
        
        if (materiaCheck.rows.length > 0) {
            console.log('   ✅ Materia encontrada:', materiaCheck.rows[0].nombre);
        } else {
            console.log('   ❌ Materia no encontrada');
        }
        
        // 5. Simular la inserción del alumno
        console.log('\n5. 👥 Simulando inserción...');
        
        try {
            const result = await pool.query(
                `INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, matricula, nombre, email, created_at`,
                [
                    testAlumnoData.matricula.trim(),
                    testAlumnoData.nombre.trim(),
                    testAlumnoData.email?.trim() || null,
                    'temporal123',
                    'alumno',
                    true
                ]
            );
            
            const nuevoAlumno = result.rows[0];
            console.log('   ✅ Alumno creado:', nuevoAlumno);
            
            // 6. Simular la asociación con la materia
            if (testAlumnoData.materia_id) {
                console.log('\n6. 🔗 Simulando asociación con materia...');
                
                await pool.query(
                    'INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion) VALUES ($1, $2, NOW())',
                    [testAlumnoData.materia_id, nuevoAlumno.id]
                );
                
                console.log('   ✅ Asociación exitosa');
                
                // Verificar asociación
                const verificacion = await pool.query(
                    'SELECT * FROM materias_estudiantes WHERE materia_id = $1 AND estudiante_id = $2',
                    [testAlumnoData.materia_id, nuevoAlumno.id]
                );
                
                if (verificacion.rows.length > 0) {
                    console.log('   ✅ Asociación verificada:', verificacion.rows[0]);
                } else {
                    console.log('   ❌ Asociación no se guardó');
                }
                
                // Limpiar asociación
                await pool.query(
                    'DELETE FROM materias_estudiantes WHERE materia_id = $1 AND estudiante_id = $2',
                    [testAlumnoData.materia_id, nuevoAlumno.id]
                );
            }
            
            // 7. Limpiar alumno de prueba
            await pool.query('DELETE FROM estudiantes WHERE id = $1', [nuevoAlumno.id]);
            
            console.log('\n🎯 Diagnóstico final:');
            console.log('✅ Inserción de alumnos: Funciona correctamente');
            console.log('✅ Asociación con materia: Funciona correctamente');
            console.log('✅ Base de datos: Operaciones exitosas');
            console.log('❌ Problema probable: Middleware o configuración de rutas');
            
        } catch (error) {
            console.error('   ❌ Error en simulación:', error.message);
            console.error('   Stack:', error.stack);
        }
        
    } catch (error) {
        console.error('❌ Error general en test:', error.message);
    } finally {
        await pool.end();
    }
}

testCreateAlumnoDebug();
