const pool = require('./database/connection.js');

async function debugProblemasActualesV2() {
    try {
        console.log('🐛 DEBUG: Análisis problemas actuales v2...');
        
        // 1. Verificar el problema del upload HTM
        console.log('1. 📄 Analizando problema upload HTM...');
        console.log('   ✅ Frontend procesa 19 filas correctamente');
        console.log('   ❌ Backend devuelve 400 "Unexpected end of form"');
        console.log('   🔍 No hay logs del backend uploadFile');
        console.log('   💡 El error está en multer ANTES del controller');
        
        // 2. Verificar el problema del alumno en materia 3
        console.log('\n2. 👥 Analizando problema alumno en materia 3...');
        console.log('   ✅ Backend dice: "Alumno asociado a materia 3"');
        console.log('   ❌ getAlumnosByMateria devuelve solo 3 alumnos (no incluye el nuevo)');
        console.log('   🔍 El alumno 2021-1022 no aparece en la consulta');
        
        // 3. Verificar qué alumnos están en materia 3
        console.log('\n3. 🔍 Verificando alumnos en materia 3...');
        
        const alumnosMateria3 = await pool.query(`
            SELECT e.id, e.matricula, e.nombre, e.email, e.created_at,
                   me.fecha_inscripcion, me.activo,
                   (SELECT COALESCE(AVG(c.calificacion), 0) 
                    FROM calificaciones c 
                    WHERE c.estudiante_id = e.id AND c.materia_id = $1) as calificacion_final
            FROM estudiantes e
            LEFT JOIN materias_estudiantes me ON e.id = me.estudiante_id
            WHERE me.materia_id = $1 AND me.activo = true
            ORDER BY e.nombre
        `, [3]);
        
        console.log(`   📥 Alumnos en materia 3 (BD directa): ${alumnosMateria3.rows.length}`);
        if (alumnosMateria3.rows.length > 0) {
            alumnosMateria3.rows.forEach((alumno, index) => {
                console.log(`      ${index + 1}. ${alumno.nombre} (${alumno.matricula}) - Final: ${alumno.calificacion_final}`);
            });
        } else {
            console.log('   ❌ No hay alumnos en materia 3');
        }
        
        // 4. Verificar si el alumno 2021-1022 está en materia 3
        console.log('\n4. 🔍 Verificando alumno 2021-1022 en materia 3...');
        
        const alumno2021_1022 = await pool.query(`
            SELECT e.id, e.matricula, e.nombre, e.email,
                   me.materia_id, me.fecha_inscripcion, me.activo
            FROM estudiantes e
            LEFT JOIN materias_estudiantes me ON e.id = me.estudiante_id
            WHERE e.matricula = $1
        `, ['2021-1022']);
        
        console.log(`   📥 Alumno 2021-1022 encontrado: ${alumno2021_1022.rows.length}`);
        if (alumno2021_1022.rows.length > 0) {
            alumno2021_1022.rows.forEach((alumno, index) => {
                console.log(`      ${index + 1}. ID: ${alumno.id}, Materia: ${alumno.materia_id}, Activo: ${alumno.activo}`);
            });
        }
        
        // 5. Analizar el problema del upload
        console.log('\n5. 📄 Analizando problema upload en detalle...');
        console.log('   🔍 El frontend envía FormData con:');
        console.log('      - archivo: Resumen de lista de clase.htm (32KB)');
        console.log('      - materia_id: 3');
        console.log('   🔍 El backend debería recibir:');
        console.log('      - req.file: EXISTS');
        console.log('      - req.body: { materia_id: "3" }');
        console.log('   ❌ Pero no hay logs del backend');
        console.log('   💡 El error está en multer parsing');
        
        // 6. Sugerir solución específica
        console.log('\n6. 💡 Solución específica...');
        console.log('   🔧 Paso 1: Cambiar configuración de multer');
        console.log('      - Usar memoryStorage en lugar de diskStorage');
        console.log('      - Agregar más opciones de parsing');
        console.log('      - Deshabilitar límites temporales');
        console.log('');
        console.log('   🔧 Paso 2: Verificar getAlumnosByMateria');
        console.log('      - La consulta SQL debe estar correcta');
        console.log('      - Verificar que el alumno esté activo');
        console.log('      - Verificar que la materia sea correcta');
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema 1: Upload HTM devuelve 400');
        console.log('   - Causa: Error en multer parsing');
        console.log('   - Solución: Cambiar configuración de multer');
        console.log('');
        console.log('❌ Problema 2: Alumno no aparece en lista');
        console.log('   - Causa: getAlumnosByMateria no devuelve el alumno');
        console.log('   - Solución: Verificar consulta SQL y datos');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugProblemasActualesV2();
