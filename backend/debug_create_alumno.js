const pool = require('./database/connection.js');

async function debugCreateAlumno() {
    try {
        console.log('🐛 DEBUG: Probando createAlumno con datos reales...');
        
        // Simular datos que vendrían del frontend
        const testData = {
            materia_id: 1,
            matricula: 'DEBUG_' + Date.now(),
            nombre: 'Estudiante Debug',
            email: 'debug@test.com'
        };
        
        console.log('📡 Datos de prueba:', testData);
        
        // 1. Verificar que la materia existe
        console.log('1. 🔍 Verificando materia...');
        const materiaCheck = await pool.query('SELECT id, nombre FROM materias WHERE id = $1', [testData.materia_id]);
        if (materiaCheck.rows.length === 0) {
            console.log('❌ Materia no existe');
            return;
        }
        console.log('✅ Materia encontrada:', materiaCheck.rows[0].nombre);
        
        // 2. Verificar si la matrícula ya existe
        console.log('2. 🔍 Verificando matrícula...');
        const matriculaCheck = await pool.query('SELECT id FROM estudiantes WHERE matricula = $1', [testData.matricula]);
        if (matriculaCheck.rows.length > 0) {
            console.log('❌ Matrícula ya existe');
            return;
        }
        console.log('✅ Matrícula disponible');
        
        // 3. Intentar crear estudiante
        console.log('3. 👥 Creando estudiante...');
        let nuevoEstudiante;
        try {
            const result = await pool.query(`
                INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
                RETURNING id, matricula, nombre, email, created_at
            `, [
                testData.matricula.trim(),
                testData.nombre.trim(),
                testData.email?.trim() || null,
                'temporal123',
                'alumno',
                true
            ]);
            
            nuevoEstudiante = result.rows[0];
            console.log('✅ Estudiante creado:', nuevoEstudiante);
            
        } catch (error) {
            console.error('❌ Error creando estudiante:', error.message);
            console.error('Stack:', error.stack);
            return;
        }
        
        // 4. Intentar asociar a materia
        console.log('4. 🔗 Asociando a materia...');
        try {
            await pool.query(`
                INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion)
                VALUES ($1, $2, NOW())
            `, [testData.materia_id, nuevoEstudiante.id]);
            
            console.log('✅ Asociación exitosa');
            
            // Verificar que se guardó
            const verifyResult = await pool.query(`
                SELECT * FROM materias_estudiantes 
                WHERE materia_id = $1 AND estudiante_id = $2
            `, [testData.materia_id, nuevoEstudiante.id]);
            
            console.log('✅ Verificación de asociación:', verifyResult.rows[0]);
            
        } catch (error) {
            console.error('❌ Error asociando a materia:', error.message);
            console.error('Stack:', error.stack);
            console.error('Datos:', {
                materia_id: testData.materia_id,
                estudiante_id: nuevoEstudiante.id
            });
        }
        
        // 5. Limpiar datos de prueba
        console.log('5. 🧹 Limpiando...');
        await pool.query('DELETE FROM materias_estudiantes WHERE estudiante_id = $1', [nuevoEstudiante.id]);
        await pool.query('DELETE FROM estudiantes WHERE id = $1', [nuevoEstudiante.id]);
        console.log('✅ Limpieza completada');
        
        console.log('\n🎯 DEBUG COMPLETADO - createAlumno funciona correctamente');
        
    } catch (error) {
        console.error('❌ Error general en DEBUG:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

debugCreateAlumno();
