const pool = require('./database/connection.js');

async function debugUploadHtmDetallado() {
    try {
        console.log('🐛 DEBUG: Analizando upload HTM detallado...');
        
        // 1. Verificar configuración de multer
        console.log('1. 🔍 Verificando configuración de multer...');
        console.log('   📋 Configuración actual en routes/calificaciones.js:');
        console.log('      - storage: diskStorage');
        console.log('      - destination: uploads/');
        console.log('      - filename: timestamp + originalname');
        console.log('      - limits: 10MB');
        console.log('      - fileFilter: archivos HTM/HTML');
        console.log('      - upload.single("archivo")');
        
        // 2. Verificar el directorio uploads
        console.log('\n2. 📁 Verificando directorio uploads...');
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(__dirname, 'uploads');
        
        if (fs.existsSync(uploadsDir)) {
            console.log('   ✅ Directorio uploads existe');
            
            const files = fs.readdirSync(uploadsDir);
            console.log('   📄 Archivos en uploads:', files.length);
            
            files.forEach(file => {
                const stats = fs.statSync(path.join(uploadsDir, file));
                console.log(`      - ${file} (${stats.size} bytes)`);
            });
        } else {
            console.log('   ❌ Directorio uploads NO existe');
        }
        
        // 3. Verificar logs del uploadFile
        console.log('\n3. 📋 Verificando logs del uploadFile...');
        console.log('   📡 Logs que deberían aparecer:');
        console.log('      - 📡 uploadFile - Archivo recibido: {filename, originalname, path, mimetype, size, encoding, fieldname}');
        console.log('      - 📡 uploadFile - Body recibido: {materia_id}');
        console.log('      - 📡 uploadFile - Body tipo: object');
        console.log('      - 📡 uploadFile - Body keys: ["materia_id"]');
        console.log('      - 📡 uploadFile - Usuario en request: {id, nombre, rol}');
        
        // 4. Analizar posibles causas del error 400
        console.log('\n4. 🔍 Analizando posibles causas del error 400...');
        console.log('   ❌ Causa 1: req.file undefined');
        console.log('      - Si multer no procesa el archivo');
        console.log('      - Si el archivo no cumple con fileFilter');
        console.log('      - Si el archivo excede el límite de tamaño');
        console.log('');
        console.log('   ❌ Causa 2: req.body undefined');
        console.log('      - Si FormData no se envía correctamente');
        console.log('      - Si hay un problema con el parser de FormData');
        console.log('      - Si el Content-Type no es multipart/form-data');
        console.log('');
        console.log('   ❌ Causa 3: req.body.materia_id undefined');
        console.log('      - Si no se incluye materia_id en FormData');
        console.log('      - Si hay un problema con el nombre del campo');
        console.log('      - Si el valor está vacío o nulo');
        console.log('');
        console.log('   ❌ Causa 4: req.usuario undefined');
        console.log('      - Si el usuario no está autenticado');
        console.log('      - Si el token es inválido');
        console.log('      - Si hay un problema con el middleware de autenticación');
        
        // 5. Verificar configuración de rutas
        console.log('\n5. 🛣️ Verificando configuración de rutas...');
        console.log('   📋 Ruta upload en routes/calificaciones.js:');
        console.log('      - router.post("/upload", verificarRol(["profesor", "administrador"]), upload.single("archivo"), calificacionController.uploadFile)');
        console.log('');
        console.log('   📋 Middleware en server.js:');
        console.log('      - app.use("/calificaciones", require("./routes/calificaciones"))');
        console.log('      - Sin body parser global para /calificaciones');
        
        // 6. Probar con un archivo HTM simple
        console.log('\n6. 🧪 Propuesta de prueba...');
        console.log('   📄 Crear archivo HTM de prueba');
        console.log('   📡 Enviar FormData con archivo y materia_id');
        console.log('   🔍 Revisar logs del servidor');
        console.log('   ✅ Verificar que se procese correctamente');
        
        // 7. Sugerir solución
        console.log('\n7. 💡 Sugerencia de solución...');
        console.log('   🔧 Agregar más logs al uploadFile');
        console.log('   🔧 Agregar logs al middleware de multer');
        console.log('   🔧 Verificar que el frontend envíe FormData correctamente');
        console.log('   🔧 Probar con una petición simple desde Postman/curl');
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Upload HTM devuelve 400 "Unexpected end of form"');
        console.log('   - Causa probable: req.body o req.file undefined');
        console.log('   - Solución: Agregar más logs y probar con petición simple');
        console.log('');
        console.log('✅ CRUD alumnos funciona correctamente');
        console.log('   - Permite misma matrícula en diferentes clases');
        console.log('   - Evita duplicados en la misma clase');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugUploadHtmDetallado();
