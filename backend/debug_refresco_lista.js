const pool = require('./database/connection.js');

async function debugRefrescoLista() {
    try {
        console.log('🐛 DEBUG: Analizando problema de refresco de lista...');
        
        // 1. Verificar si hay alumnos en materia 14
        console.log('1. 👥 Verificando alumnos en materia 14...');
        
        const alumnosMateria14 = await pool.query(`
            SELECT e.id, e.matricula, e.nombre, e.email, e.created_at,
                   me.fecha_inscripcion, me.activo
            FROM estudiantes e
            LEFT JOIN materias_estudiantes me ON e.id = me.estudiante_id
            WHERE me.materia_id = $1
            ORDER BY e.nombre
        `, [14]);
        
        console.log(`   📥 Alumnos en materia 14: ${alumnosMateria14.rows.length}`);
        if (alumnosMateria14.rows.length > 0) {
            alumnosMateria14.rows.forEach((alumno, index) => {
                console.log(`      ${index + 1}. ${alumno.nombre} (${alumno.matricula}) - ${alumno.email}`);
            });
        } else {
            console.log('   ❌ No hay alumnos en materia 14');
        }
        
        // 2. Verificar si hay alumnos en materia 20
        console.log('\n2. 👥 Verificando alumnos en materia 20...');
        
        const alumnosMateria20 = await pool.query(`
            SELECT e.id, e.matricula, e.nombre, e.email, e.created_at,
                   me.fecha_inscripcion, me.activo
            FROM estudiantes e
            LEFT JOIN materias_estudiantes me ON e.id = me.estudiante_id
            WHERE me.materia_id = $1
            ORDER BY e.nombre
        `, [20]);
        
        console.log(`   📥 Alumnos en materia 20: ${alumnosMateria20.rows.length}`);
        if (alumnosMateria20.rows.length > 0) {
            alumnosMateria20.rows.forEach((alumno, index) => {
                console.log(`      ${index + 1}. ${alumno.nombre} (${alumno.matricula}) - ${alumno.email}`);
            });
        } else {
            console.log('   ❌ No hay alumnos en materia 20');
        }
        
        // 3. Simular la llamada a getAlumnosByMateria
        console.log('\n3. 🔍 Simulando getAlumnosByMateria...');
        console.log('   📡 Si se llama a /calificaciones/materia/14/alumnos');
        console.log('   📡 Debería devolver:', alumnosMateria14.rows.length, 'alumnos');
        
        console.log('   📡 Si se llama a /calificaciones/materia/20/alumnos');
        console.log('   📡 Debería devolver:', alumnosMateria20.rows.length, 'alumnos');
        
        // 4. Analizar problema del frontend
        console.log('\n4. 🔍 Analizando problema del frontend...');
        console.log('   📋 Posibles causas:');
        console.log('      a) materiaSelect no tiene valor correcto');
        console.log('      b) cargarAlumnos() no se llama después de crear alumno');
        console.log('      c) La API no devuelve los datos correctamente');
        console.log('      d) El frontend no procesa la respuesta correctamente');
        console.log('      e) Hay un error en el renderizado');
        
        // 5. Sugerir solución
        console.log('\n5. 💡 Sugerencia de solución...');
        console.log('   🔧 Paso 1: Verificar logs del frontend');
        console.log('      - cargarAlumnos - materia_id: ?');
        console.log('      - cargarAlumnos - Solicitando alumnos para materia: ?');
        console.log('      - cargarAlumnos - Alumnos recibidos: ?');
        console.log('');
        console.log('   🔧 Paso 2: Verificar que materiaSelect tenga valor');
        console.log('      - Debería ser "14" o "20"');
        console.log('      - Si está vacío, no carga alumnos');
        console.log('');
        console.log('   🔧 Paso 3: Verificar que se llame a cargarAlumnos()');
        console.log('      - Después de crear alumno');
        console.log('      - Después de procesar upload');
        console.log('      - Al cambiar de materia');
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema: Alumno agregado no se muestra en lista');
        console.log('   - Causa probable: materiaSelect no tiene valor correcto');
        console.log('   - Solución: Verificar logs del frontend');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugRefrescoLista();
