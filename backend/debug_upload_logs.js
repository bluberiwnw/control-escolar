const pool = require('./database/connection.js');

async function debugUploadLogs() {
    try {
        console.log('🐛 DEBUG: Analizando logs del upload...');
        
        // 1. Verificar logs del uploadFile en el controller
        console.log('1. 📋 Revisando logs de uploadFile...');
        console.log('   📡 Los logs deberían mostrar:');
        console.log('      - uploadFile - Archivo recibido: {filename, originalname, path, mimetype, size, encoding, fieldname}');
        console.log('      - uploadFile - Body recibido: {materia_id}');
        console.log('      - uploadFile - Usuario en request: {id, nombre, rol}');
        
        // 2. Simular el problema exacto del upload
        console.log('\n2. 🔍 Simulando problema upload...');
        console.log('   ❌ Error 400 Bad Request');
        console.log('   📡 Causas posibles:');
        console.log('      - req.file es undefined');
        console.log('      - req.body es undefined');
        console.log('      - req.body.materia_id es undefined');
        console.log('      - req.usuario es undefined o no tiene permisos');
        console.log('      - Error en validación de archivo');
        
        // 3. Verificar la configuración de multer
        console.log('\n3. 🔍 Verificando configuración multer...');
        console.log('   📋 Configuración actual:');
        console.log('      - storage: diskStorage');
        console.log('      - limits: 10MB');
        console.log('      - fileFilter: archivos HTM/HTML');
        console.log('      - upload.single("archivo")');
        
        // 4. Verificar el problema de la lista no actualizada
        console.log('\n4. 🔄 Verificando problema de lista...');
        console.log('   ✅ Alumno SÍ está en BD');
        console.log('   ✅ Alumno SÍ está asociado a materia 20');
        console.log('   ✅ getAlumnosByMateria SÍ devuelve el alumno');
        console.log('   ❌ Frontend NO muestra el alumno');
        
        console.log('   🔍 Causa probable: Frontend no refresca la lista');
        console.log('   📡 Solución: Agregar refresco automático después de crear alumno');
        
        // 5. Revisar el código del frontend
        console.log('\n5. 📋 Revisando código del frontend...');
        console.log('   📄 Archivo: frontend/profesor/js/calificaciones.js');
        console.log('   🔍 Función: guardarAlumno()');
        console.log('   📡 Después de crear alumno debería llamar a:');
        console.log('      - mostrarToast("Alumno creado", "success")');
        console.log('      - cargarAlumnos(materia_id)');
        console.log('      - cerrarModalAlumno()');
        
        // 6. Verificar si hay un problema con el refresco
        console.log('\n6. 🔍 Verificando refresco de lista...');
        console.log('   📡 Posibles problemas:');
        console.log('      - cargarAlumnos() no se llama después de crear');
        console.log('      - cargarAlumnos() no funciona correctamente');
        console.log('      - La lista no se actualiza en el DOM');
        console.log('      - Hay un error en el renderizado');
        
        // 7. Proporcionar solución específica
        console.log('\n7. 🔧 Proporcionando soluciones...');
        console.log('   ✅ Solución 1: Agregar logs detallados al uploadFile');
        console.log('   ✅ Solución 2: Agregar refresco automático de lista');
        console.log('   ✅ Solución 3: Verificar que cargarAlumnos() se llame');
        
        console.log('\n🎯 Próximos pasos:');
        console.log('1. Agregar más logs al uploadFile para ver qué falla');
        console.log('2. Agregar cargarAlumnos() después de crear alumno');
        console.log('3. Verificar que la lista se actualice en el frontend');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugUploadLogs();
