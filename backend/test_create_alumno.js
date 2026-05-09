const pool = require('./database/connection.js');

async function testCreateAlumno() {
    try {
        console.log('🧪 Probando creación de alumno...');
        
        // 1. Verificar que la tabla materias_estudiantes existe y su estructura
        console.log('1. 🔍 Verificando tabla materias_estudiantes...');
        const tableCheck = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'materias_estudiantes' 
            ORDER BY ordinal_position
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log('✅ Tabla materias_estudiantes existe con estructura:');
            tableCheck.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
            });
        } else {
            console.log('❌ Tabla materias_estudiantes NO existe');
            return;
        }
        
        // 2. Obtener una materia existente para la prueba
        console.log('2. 📚 Buscando materia existente...');
        const materiaResult = await pool.query('SELECT id FROM materias LIMIT 1');
        if (materiaResult.rows.length === 0) {
            console.log('❌ No hay materias para probar');
            return;
        }
        const materiaId = materiaResult.rows[0].id;
        console.log('✅ Materia encontrada:', materiaId);
        
        // 3. Probar inserción de estudiante
        console.log('3. 👥 Creando estudiante de prueba...');
        const estudianteData = {
            matricula: 'TEST_' + Date.now(),
            nombre: 'Estudiante Prueba',
            email: 'test@test.com',
            password: 'temporal123',
            rol: 'alumno',
            activo: true
        };
        
        const estudianteResult = await pool.query(`
            INSERT INTO estudiantes (matricula, nombre, email, password, rol, activo, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
            RETURNING id, matricula, nombre, email
        `, [
            estudianteData.matricula,
            estudianteData.nombre,
            estudianteData.email,
            estudianteData.password,
            estudianteData.rol,
            estudianteData.activo
        ]);
        
        const nuevoEstudiante = estudianteResult.rows[0];
        console.log('✅ Estudiante creado:', nuevoEstudiante);
        
        // 4. Probar asociación con materia
        console.log('4. 🔗 Asociando estudiante a materia...');
        try {
            await pool.query(`
                INSERT INTO materias_estudiantes (materia_id, estudiante_id, fecha_inscripcion)
                VALUES ($1, $2, NOW())
            `, [materiaId, nuevoEstudiante.id]);
            
            console.log('✅ Asociación materia-estudiante exitosa');
        } catch (error) {
            console.error('❌ Error en asociación materia-estudiante:', error.message);
            console.error('Stack:', error.stack);
        }
        
        // 5. Verificar que la asociación se guardó
        console.log('5. 🔍 Verificando asociación guardada...');
        const asociacionCheck = await pool.query(`
            SELECT * FROM materias_estudiantes 
            WHERE materia_id = $1 AND estudiante_id = $2
        `, [materiaId, nuevoEstudiante.id]);
        
        if (asociacionCheck.rows.length > 0) {
            console.log('✅ Asociación verificada:', asociacionCheck.rows[0]);
        } else {
            console.log('❌ Asociación no se guardó');
        }
        
        // 6. Limpiar datos de prueba
        console.log('6. 🧹 Limpiando datos de prueba...');
        await pool.query('DELETE FROM materias_estudiantes WHERE estudiante_id = $1', [nuevoEstudiante.id]);
        await pool.query('DELETE FROM estudiantes WHERE matricula = $1', [nuevoEstudiante.matricula]);
        console.log('✅ Limpieza completada');
        
        console.log('\n🎯 Prueba completada exitosamente');
        
    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

testCreateAlumno();
