const pool = require('./database/connection.js');

async function debugFinalCritico() {
    try {
        console.log('🐛 DEBUG: Análisis final crítico...');
        
        // 1. Verificar si el alumno se está creando realmente
        console.log('1. 👥 Verificando creación de alumno...');
        
        const alumnoBusqueda = await pool.query(
            'SELECT * FROM estudiantes WHERE matricula = $1',
            ['2021-1022']
        );
        
        if (alumnoBusqueda.rows.length > 0) {
            console.log('   ✅ Alumno encontrado en BD:', alumnoBusqueda.rows[0]);
            
            // Verificar en qué materias está inscrito
            const materiasAlumno = await pool.query(`
                SELECT m.id, m.nombre, me.fecha_inscripcion
                FROM materias m
                JOIN materias_estudiantes me ON m.id = me.materia_id
                WHERE me.estudiante_id = $1
                ORDER BY m.nombre
            `, [alumnoBusqueda.rows[0].id]);
            
            console.log('   📚 Materias donde está inscrito:');
            if (materiasAlumno.rows.length > 0) {
                materiasAlumno.rows.forEach(m => {
                    console.log(`      - ID ${m.id}: ${m.nombre} (${m.fecha_inscripcion})`);
                });
            } else {
                console.log('      - No está inscrito en ninguna materia');
            }
        } else {
            console.log('   ❌ Alumno NO encontrado en BD');
        }
        
        // 2. Verificar getAlumnosByMateria
        console.log('\n2. 📊 Verificando getAlumnosByMateria...');
        
        // Probar con materia_id 20
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
                console.log(`      ${index + 1}. ${alumno.nombre} (${alumno.matricula})`);
            });
        } else {
            console.log('   ❌ No hay alumnos en materia 20');
        }
        
        // Probar con materia_id 14
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
                console.log(`      ${index + 1}. ${alumno.nombre} (${alumno.matricula})`);
            });
        } else {
            console.log('   ❌ No hay alumnos en materia 14');
        }
        
        // 3. Analizar el problema del upload HTM
        console.log('\n3. 📄 Analizando problema upload HTM...');
        console.log('   📡 Frontend procesa correctamente 19 filas');
        console.log('   ❌ Backend devuelve 400 "Unexpected end of form"');
        console.log('   🔍 Causas posibles:');
        console.log('      - req.file undefined');
        console.log('      - req.body undefined');
        console.log('      - req.body.materia_id undefined');
        console.log('      - Error en multer');
        console.log('      - Error en validación de archivo');
        
        // 4. Verificar si hay logs del uploadFile
        console.log('\n4. 📋 Verificando si hay logs del uploadFile...');
        console.log('   📡 Los logs deberían mostrar:');
        console.log('      - 📡 uploadFile - Archivo recibido: {...}');
        console.log('      - 📡 uploadFile - Body recibido: {...}');
        console.log('      - 📡 uploadFile - Body tipo: object');
        console.log('      - 📡 uploadFile - Body keys: ["materia_id"]');
        console.log('      - 📡 uploadFile - Usuario en request: {...}');
        
        // 5. Verificar si hay logs del createAlumno
        console.log('\n5. 👥 Verificando si hay logs del createAlumno...');
        console.log('   📡 Los logs deberían mostrar:');
        console.log('      - 📡 createAlumno - Creando nuevo alumno');
        console.log('      - 📡 createAlumno - Body recibido: {...}');
        console.log('      - 📡 createAlumno - Body tipo: object');
        console.log('      - 📡 createAlumno - Body keys: ["alumnoId", "materia_id", "matricula", "nombre", "email"]');
        console.log('      - 📡 createAlumno - Usuario en request: {...}');
        
        // 6. Verificar si hay logs del frontend
        console.log('\n6. 🔍 Verificando si hay logs del frontend...');
        console.log('   📡 Los logs deberían mostrar:');
        console.log('      - 🔍 guardarAlumno - Datos del formulario: {...}');
        console.log('      - ✅ Alumno creado exitosamente: {...}');
        console.log('      - 🔄 Refrescando lista de alumnos...');
        console.log('      - ✅ Lista de alumnos refrescada');
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema 1: Alumno agregado no se muestra en lista');
        console.log('   - Causa probable: No se está llamando a cargarAlumnos() o hay error en getAlumnosByMateria');
        console.log('   - Solución: Verificar logs del frontend y backend');
        console.log('');
        console.log('❌ Problema 2: Upload HTM devuelve 400 "Unexpected end of form"');
        console.log('   - Causa probable: req.body o req.file undefined');
        console.log('   - Solución: Revisar logs del uploadFile');
        
        console.log('\n🔍 Próximos pasos:');
        console.log('1. Revisar logs del servidor cuando se ejecutan las acciones');
        console.log('2. Verificar que los middleware funcionen correctamente');
        console.log('3. Probar con una petición simple desde el navegador');
        console.log('4. Verificar que el frontend esté llamando a las funciones correctas');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugFinalCritico();
