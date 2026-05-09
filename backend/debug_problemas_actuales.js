const pool = require('./database/connection.js');

async function debugProblemasActuales() {
    try {
        console.log('🐛 DEBUG: Analizando problemas actuales...');
        
        // 1. Verificar en qué materias está el alumno 2021-1022
        console.log('1. 👥 Verificando materias del alumno 2021-1022...');
        
        const alumnoInfo = await pool.query(
            'SELECT * FROM estudiantes WHERE matricula = $1',
            ['2021-1022']
        );
        
        if (alumnoInfo.rows.length > 0) {
            console.log('   ✅ Alumno encontrado:', alumnoInfo.rows[0].nombre);
            
            const materiasAlumno = await pool.query(`
                SELECT m.id, m.nombre, me.fecha_inscripcion
                FROM materias m
                JOIN materias_estudiantes me ON m.id = me.materia_id
                WHERE me.estudiante_id = $1
                ORDER BY m.nombre
            `, [alumnoInfo.rows[0].id]);
            
            console.log('   📚 Materias donde está inscrito:');
            materiasAlumno.rows.forEach(m => {
                console.log(`      - ID ${m.id}: ${m.nombre} (${m.fecha_inscripcion})`);
            });
            
            // Verificar si está en materia 1
            const materia1Check = materiasAlumno.rows.find(m => m.id == 1);
            if (materia1Check) {
                console.log('   ❌ Alumno YA está inscrito en materia 1 (Programación I)');
                console.log('   💡 Por eso devuelve error 400 al intentar agregarlo de nuevo');
            } else {
                console.log('   ✅ Alumno NO está inscrito en materia 1');
            }
        }
        
        // 2. Analizar el problema del upload HTM
        console.log('\n2. 📄 Analizando problema upload HTM...');
        console.log('   📡 Frontend procesa correctamente 19 filas');
        console.log('   ❌ Backend devuelve 400 "Unexpected end of form"');
        console.log('   🔍 El problema es que req.body o req.file están undefined');
        console.log('   💡 Necesito revisar los logs del uploadFile');
        
        // 3. Sugerir soluciones
        console.log('\n3. 💡 Soluciones propuestas...');
        console.log('   🔧 Problema 1: Alumno ya inscrito en materia');
        console.log('      - Solución: Cambiar el mensaje de error para ser más claro');
        console.log('      - Solución: Permitir agregar a diferentes materias');
        console.log('      - Solución: Mostrar en qué materias ya está inscrito');
        console.log('');
        console.log('   🔧 Problema 2: Upload HTM falla');
        console.log('      - Solución: Revisar logs del multer');
        console.log('      - Solución: Verificar que req.body.materia_id llegue');
        console.log('      - Solución: Probar con una petición simple');
        
        // 4. Verificar si hay logs del upload
        console.log('\n4. 📋 Verificando si hay logs del upload...');
        console.log('   📡 Los logs que deberían aparecer:');
        console.log('      - Multer fileFilter - Archivo recibido: {...}');
        console.log('      - Multer fileFilter - Archivo aceptado');
        console.log('      - 📡 uploadFile - Archivo recibido: {...}');
        console.log('      - 📡 uploadFile - Body recibido: {...}');
        console.log('      - 📡 uploadFile - Body tipo: object');
        console.log('      - 📡 uploadFile - Body keys: ["materia_id"]');
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema 1: Alumno ya inscrito en materia 1');
        console.log('   - Causa: El alumno 2021-1022 ya está en Programación I');
        console.log('   - Solución: Intentar agregarlo a otra materia o mostrar mensaje claro');
        console.log('');
        console.log('❌ Problema 2: Upload HTM devuelve 400');
        console.log('   - Causa: req.body o req.file undefined');
        console.log('   - Solución: Revisar logs del servidor');
        
        console.log('\n🔍 Próximos pasos:');
        console.log('1. Probar agregar el alumno a una materia diferente');
        console.log('2. Revisar logs del servidor cuando se hace upload');
        console.log('3. Verificar que el frontend envíe FormData correctamente');
        console.log('4. Probar con un archivo HTM simple');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugProblemasActuales();
