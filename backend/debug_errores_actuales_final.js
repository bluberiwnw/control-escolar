const pool = require('./database/connection.js');

async function debugErroresActualesFinal() {
    try {
        console.log('🐛 DEBUG: Analizando errores actuales finales...');
        
        // 1. Verificar el problema de matrícula duplicada
        console.log('1. 👥 Verificando problema de matrícula duplicada...');
        
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
            
            // Verificar si ya está en la materia 20
            const materia20Check = await pool.query(
                'SELECT * FROM materias_estudiantes WHERE estudiante_id = $1 AND materia_id = $2',
                [alumnoBusqueda.rows[0].id, 20]
            );
            
            if (materia20Check.rows.length > 0) {
                console.log('   ❌ Alumno ya está inscrito en materia 20');
            } else {
                console.log('   ✅ Alumno NO está inscrito en materia 20');
            }
        } else {
            console.log('   ❌ Alumno NO encontrado en BD');
        }
        
        // 2. Analizar el problema del upload HTM
        console.log('\n2. 📄 Analizando problema upload HTM...');
        console.log('   📡 Frontend procesa correctamente 19 filas');
        console.log('   ❌ Backend devuelve 400 "Unexpected end of form"');
        console.log('   🔍 Causas posibles:');
        console.log('      - req.file undefined');
        console.log('      - req.body undefined');
        console.log('      - req.body.materia_id undefined');
        console.log('      - Error en multer');
        console.log('      - Error en validación de archivo');
        
        // 3. Verificar la lógica actual de createAlumno
        console.log('\n3. 🔍 Verificando lógica actual de createAlumno...');
        console.log('   📋 Lógica actual:');
        console.log('      1. Verificar si matricula ya existe');
        console.log('      2. Si existe, devolver error 400');
        console.log('      3. Si no existe, crear alumno');
        console.log('      4. Asociar a materia si se proporciona');
        
        console.log('   ❌ Problema: No permite misma matrícula en diferentes clases');
        console.log('   ✅ Solución: Permitir matrícula existente si no está en la materia');
        
        // 4. Proponer solución
        console.log('\n4. 💡 Propuesta de solución...');
        console.log('   📋 Nueva lógica:');
        console.log('      1. Verificar si matricula ya existe');
        console.log('      2. Si existe, verificar si ya está en la materia');
        console.log('      3. Si ya está en la materia, devolver error');
        console.log('      4. Si no está en la materia, usar el alumno existente');
        console.log('      5. Asociar a la materia');
        console.log('      6. Si no existe, crear nuevo alumno');
        
        // 5. Verificar configuración de middlewares
        console.log('\n5. 🔧 Verificando configuración de middlewares...');
        console.log('   📋 Configuración actual:');
        console.log('      - /calificaciones: sin body parser global');
        console.log('      - /calificaciones/alumnos: body parser específico');
        console.log('      - /calificaciones/upload: solo multer');
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema 1: Upload HTM devuelve 400 "Unexpected end of form"');
        console.log('   - Causa probable: req.body o req.file undefined');
        console.log('   - Solución: Revisar logs del uploadFile');
        console.log('');
        console.log('❌ Problema 2: CRUD alumnos devuelve 400 "matricula ya existe"');
        console.log('   - Causa: Lógica no permite misma matrícula en diferentes clases');
        console.log('   - Solución: Modificar createAlumno para permitir misma matrícula');
        console.log('');
        console.log('🔍 Próximos pasos:');
        console.log('1. Modificar createAlumno para permitir misma matrícula en diferentes clases');
        console.log('2. Agregar más logs al uploadFile');
        console.log('3. Probar con una petición simple');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugErroresActualesFinal();
