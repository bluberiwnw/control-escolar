const pool = require('./database/connection.js');

async function debugErroresCriticos() {
    try {
        console.log('🐛 DEBUG: Analizando errores críticos...');
        
        // 1. Verificar que la materia_id 14 exista
        console.log('1. 📚 Verificando materia_id 14...');
        
        const materiaResult = await pool.query(
            'SELECT id, nombre, profesor_id FROM materias WHERE id = $1',
            [14]
        );
        
        if (materiaResult.rows.length > 0) {
            console.log('   ✅ Materia encontrada:', materiaResult.rows[0]);
        } else {
            console.log('   ❌ Materia 14 NO existe');
            
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
                [alumnoBusqueda.rows[0].id, 14]
            );
            
            if (asociacionResult.rows.length > 0) {
                console.log('   ✅ Alumno asociado a materia:', asociacionResult.rows[0]);
            } else {
                console.log('   ❌ Alumno NO está asociado a materia 14');
            }
        } else {
            console.log('   ❌ Alumno NO encontrado en BD');
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
        
        // 4. Analizar el problema del CRUD alumnos
        console.log('\n4. 👥 Analizando problema CRUD alumnos...');
        console.log('   📡 Frontend envía datos correctos');
        console.log('   ❌ Backend devuelve 400 Bad Request');
        console.log('   🔍 Causas posibles:');
        console.log('      - req.body undefined');
        console.log('      - req.body.materia_id undefined');
        console.log('      - req.body.matricula undefined');
        console.log('      - req.body.nombre undefined');
        console.log('      - Error en validación');
        console.log('      - Error en body parser');
        
        // 5. Verificar configuración de middlewares
        console.log('\n5. 🔧 Verificando configuración de middlewares...');
        console.log('   📋 Configuración actual en server.js:');
        console.log('      - /auth: body parser aplicado específicamente');
        console.log('      - /profesor: body parser aplicado específicamente');
        console.log('      - /materias: body parser aplicado específicamente');
        console.log('      - /actividades: body parser aplicado específicamente');
        console.log('      - /asistencia: body parser aplicado específicamente');
        console.log('      - /admin: body parser aplicado específicamente');
        console.log('      - /alumno: body parser aplicado específicamente');
        console.log('      - /qr: body parser aplicado específicamente');
        console.log('      - /calificaciones: sin body parser global');
        console.log('      - /calificaciones/alumnos: body parser específico');
        console.log('      - /calificaciones/upload: solo multer');
        
        // 6. Verificar si hay un problema con la configuración de rutas
        console.log('\n6. 🛣️ Verificando configuración de rutas...');
        console.log('   📋 Rutas en routes/calificaciones.js:');
        console.log('      - router.use("/alumnos", express.json())');
        console.log('      - router.use("/alumnos", express.urlencoded({ extended: true }))');
        console.log('      - router.post("/upload", upload.single("archivo"), ...)');
        console.log('      - router.post("/alumnos", ...)');
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema 1: Upload HTM devuelve 400 "Unexpected end of form"');
        console.log('   - Causa probable: req.body o req.file undefined');
        console.log('   - Solución: Revisar logs del uploadFile');
        console.log('');
        console.log('❌ Problema 2: CRUD alumnos devuelve 400');
        console.log('   - Causa probable: req.body undefined o validación fallida');
        console.log('   - Solución: Revisar logs del createAlumno');
        console.log('');
        console.log('❌ Problema 3: Alumno no aparece en lista');
        console.log('   - Causa probable: No se crea o no se refresca');
        console.log('   - Solución: Verificar si se crea y refrescar');
        
        console.log('\n🔍 Próximos pasos:');
        console.log('1. Agregar logs detallados al uploadFile');
        console.log('2. Agregar logs detallados al createAlumno');
        console.log('3. Verificar que los middlewares funcionen');
        console.log('4. Probar con una petición simple');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugErroresCriticos();
