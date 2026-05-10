const pool = require('./database/connection.js');

async function debugProblemasFinales() {
    try {
        console.log('🐛 DEBUG: Análisis problemas finales...');
        
        // 1. Verificar todas las materias y sus alumnos
        console.log('\n1. 📚 Verificando todas las materias y sus alumnos...');
        
        const materiasQuery = await pool.query(`
            SELECT DISTINCT m.id, m.nombre,
                   COUNT(me.estudiante_id) as total_alumnos
            FROM materias m
            LEFT JOIN materias_estudiantes me ON m.id = me.materia_id AND me.activo = true
            GROUP BY m.id, m.nombre
            ORDER BY m.id
        `);
        
        console.log('   📥 Materias encontradas:');
        materiasQuery.rows.forEach(materia => {
            console.log(`      ${materia.id}. ${materia.nombre} - ${materia.total_alumnos} alumnos`);
        });
        
        // 2. Verificar alumnos específicos en materia 14
        console.log('\n2. 🔍 Verificando alumnos en materia 14...');
        
        const alumnosMateria14 = await pool.query(`
            SELECT e.id, e.matricula, e.nombre, e.email,
                   me.fecha_inscripcion, me.activo
            FROM estudiantes e
            INNER JOIN materias_estudiantes me ON e.id = me.estudiante_id
            WHERE me.materia_id = 14 AND me.activo = true
            ORDER BY e.nombre
        `);
        
        console.log(`   📥 Alumnos en materia 14: ${alumnosMateria14.rows.length}`);
        if (alumnosMateria14.rows.length > 0) {
            alumnosMateria14.rows.forEach((alumno, index) => {
                console.log(`      ${index + 1}. ${alumno.nombre} (${alumno.matricula}) - Activo: ${alumno.activo}`);
            });
        } else {
            console.log('   ❌ No hay alumnos en materia 14');
        }
        
        // 3. Verificar alumnos específicos en materia 3
        console.log('\n3. 🔍 Verificando alumnos en materia 3...');
        
        const alumnosMateria3 = await pool.query(`
            SELECT e.id, e.matricula, e.nombre, e.email,
                   me.fecha_inscripcion, me.activo
            FROM estudiantes e
            INNER JOIN materias_estudiantes me ON e.id = me.estudiante_id
            WHERE me.materia_id = 3 AND me.activo = true
            ORDER BY e.nombre
        `);
        
        console.log(`   📥 Alumnos en materia 3: ${alumnosMateria3.rows.length}`);
        if (alumnosMateria3.rows.length > 0) {
            alumnosMateria3.rows.forEach((alumno, index) => {
                console.log(`      ${index + 1}. ${alumno.nombre} (${alumno.matricula}) - Activo: ${alumno.activo}`);
            });
        } else {
            console.log('   ❌ No hay alumnos en materia 3');
        }
        
        // 4. Verificar si hay alumnos sin inscripciones
        console.log('\n4. 🔍 Verificando alumnos sin inscripciones...');
        
        const alumnosSinInscripcion = await pool.query(`
            SELECT e.id, e.matricula, e.nombre, e.email
            FROM estudiantes e
            WHERE NOT EXISTS (
                SELECT 1 FROM materias_estudiantes me 
                WHERE me.estudiante_id = e.id AND me.activo = true
            )
            ORDER BY e.nombre
        `);
        
        console.log(`   📥 Alumnos sin inscripciones: ${alumnosSinInscripcion.rows.length}`);
        
        // 5. Verificar el problema del upload HTM
        console.log('\n5. 📄 Analizando problema upload HTM...');
        console.log('   🔍 El frontend procesa 19 filas correctamente');
        console.log('   🔍 El backend debería recibir:');
        console.log('      - req.file: EXISTS');
        console.log('      - req.body: { materia_id: "14" }');
        console.log('   ❌ Pero devuelve 400 sin logs del backend');
        console.log('   💡 El error está en multer ANTES del controller');
        
        // 6. Sugerir solución específica
        console.log('\n6. 💡 Solución específica...');
        console.log('   🔧 Paso 1: Simplificar multer al máximo');
        console.log('      - Usar diskStorage simple');
        console.log('      - Sin límites restrictivos');
        console.log('      - Sin fileFilter temporalmente');
        console.log('');
        console.log('   🔧 Paso 2: Verificar getAlumnosByMateria');
        console.log('      - La consulta debe devolver todos los alumnos inscritos');
        console.log('      - Verificar que la materia sea correcta');
        console.log('      - Verificar que el campo activo sea true');
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema 1: Upload HTM devuelve 400');
        console.log('   - Causa: Error en multer parsing');
        console.log('   - Solución: Simplificar multer al máximo');
        console.log('');
        console.log('❌ Problema 2: getAlumnosByMateria no devuelve todos los alumnos');
        console.log('   - Causa: Consulta SQL o datos incorrectos');
        console.log('   - Solución: Verificar consulta y datos en BD');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugProblemasFinales();
