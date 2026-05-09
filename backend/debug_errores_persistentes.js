const pool = require('./database/connection.js');

async function debugErroresPersistentes() {
    try {
        console.log('🐛 DEBUG: Analizando errores persistentes...');
        
        // 1. Verificar que la materia_id 20 exista
        console.log('1. 📚 Verificando materia_id 20...');
        
        const materiaResult = await pool.query(
            'SELECT id, nombre, profesor_id FROM materias WHERE id = $1',
            [20]
        );
        
        if (materiaResult.rows.length > 0) {
            console.log('   ✅ Materia encontrada:', materiaResult.rows[0]);
        } else {
            console.log('   ❌ Materia 20 NO existe');
            
            // Verificar qué materias existen
            const todasMaterias = await pool.query('SELECT id, nombre FROM materias ORDER BY id');
            console.log('   📋 Materias disponibles:');
            todasMaterias.rows.forEach(m => {
                console.log(`      - ID ${m.id}: ${m.nombre}`);
            });
        }
        
        // 2. Verificar si el alumno se está creando realmente
        console.log('\n2. 👥 Verificando si el alumno se está creando...');
        
        const alumnoBusqueda = await pool.query(
            'SELECT * FROM estudiantes WHERE matricula = $1',
            ['2021-1022']
        );
        
        if (alumnoBusqueda.rows.length > 0) {
            console.log('   ✅ Alumno encontrado en BD:', alumnoBusqueda.rows[0]);
            
            // Verificar si está asociado a la materia
            const asociacionResult = await pool.query(
                'SELECT * FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2',
                [alumnoBusqueda.rows[0].id, 20]
            );
            
            if (asociacionResult.rows.length > 0) {
                console.log('   ✅ Alumno asociado a materia:', asociacionResult.rows[0]);
            } else {
                console.log('   ❌ Alumno NO está asociado a materia 20');
            }
        } else {
            console.log('   ❌ Alumno NO encontrado en BD');
        }
        
        // 3. Verificar el problema del upload
        console.log('\n3. 📄 Analizando problema upload...');
        
        console.log('   📡 Datos que envía el frontend:');
        console.log('      - archivo: FormData con archivo HTM');
        console.log('      - materia_id: probablemente 20');
        console.log('      - Content-Type: multipart/form-data');
        
        console.log('   🔍 Posibles causas de error 400:');
        console.log('      - materia_id 20 no existe');
        console.log('      - req.body undefined o null');
        console.log('      - req.file undefined o null');
        console.log('      - Error en validación de archivo');
        console.log('      - Error en permisos de usuario');
        
        // 4. Verificar si hay logs del upload
        console.log('\n4. 📋 Verificando logs del upload...');
        console.log('   📡 uploadFile debería mostrar:');
        console.log('      - req.file: objeto con información del archivo');
        console.log('      - req.body: { materia_id: "20" }');
        console.log('      - req.usuario: objeto con info del usuario');
        
        // 5. Verificar el problema de la lista no actualizada
        console.log('\n5. 🔄 Verificando problema de lista no actualizada...');
        console.log('   🔍 Posibles causas:');
        console.log('      - Frontend no refresca la lista después de crear');
        console.log('      - getAlumnosByMateria no devuelve el alumno nuevo');
        console.log('      - El alumno no está asociado a la materia correcta');
        console.log('      - Error en el renderizado del frontend');
        
        // 6. Simular getAlumnosByMateria con materia_id 20
        console.log('\n6. 📊 Simulando getAlumnosByMateria...');
        
        const alumnosMateria = await pool.query(`
            SELECT e.id, e.matricula, e.nombre, e.email, e.created_at,
                   me.fecha_inscripcion, me.activo
            FROM estudiantes e
            LEFT JOIN materias_estudiantes me ON e.id = me.estudiante_id
            WHERE me.materia_id = $1
            ORDER BY e.nombre
        `, [20]);
        
        console.log(`   📥 Alumnos en materia 20: ${alumnosMateria.rows.length}`);
        if (alumnosMateria.rows.length > 0) {
            alumnosMateria.rows.forEach((alumno, index) => {
                console.log(`      ${index + 1}. ${alumno.nombre} (${alumno.matricula})`);
            });
        } else {
            console.log('   ❌ No hay alumnos en materia 20');
        }
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema 1: Upload HTM devuelve 400');
        console.log('   - Causa probable: materia_id 20 no existe o req.body undefined');
        console.log('   - Solución: Verificar existencia de materia y logs de upload');
        console.log('');
        console.log('❌ Problema 2: Alumno creado no aparece en lista');
        console.log('   - Causa probable: No asociado a materia o frontend no refresca');
        console.log('   - Solución: Verificar asociación y refrescar lista');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugErroresPersistentes();
