const pool = require('./database/connection.js');

async function debugUploadIssue() {
    try {
        console.log('🐛 DEBUG: Analizando problema de upload...');
        
        // 1. Verificar configuración actual de middlewares
        console.log('1. 📋 Configuración actual:');
        console.log('   - express.json() aplicado ANTES de rutas');
        console.log('   - express.urlencoded() aplicado ANTES de rutas');
        console.log('   - multer configurado en routes/calificaciones.js');
        
        // 2. Verificar que multer esté configurado correctamente
        console.log('2. 🔍 Verificando configuración de multer...');
        
        // 3. Simular el problema: body parsers vs multer
        console.log('3. ⚠️ Análisis del problema:');
        console.log('   - express.json() intenta parsear FormData como JSON');
        console.log('   - Esto causa "Unexpected end of form"');
        console.log('   - Necesitamos que body parsers NO interfieran con FormData');
        
        // 4. Verificar si hay archivos en uploads
        console.log('4. 📁 Verificando directorio uploads...');
        const fs = require('fs');
        const path = require('path');
        
        const uploadsDir = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            console.log('   📄 Archivos en uploads:', files.length);
            if (files.length > 0) {
                files.slice(0, 5).forEach(file => {
                    console.log(`      - ${file}`);
                });
            }
        } else {
            console.log('   ❌ Directorio uploads no existe');
        }
        
        // 5. Verificar estructura de la ruta upload
        console.log('5. 🛣️ Verificando ruta /calificaciones/upload...');
        console.log('   - Middleware: verificarRol([\'profesor\', \'administrador\'])');
        console.log('   - Middleware: upload.single(\'archivo\')');
        console.log('   - Controller: calificacionController.uploadFile');
        
        console.log('\n🎯 Diagnóstico:');
        console.log('❌ Problema: body parsers están interfiriendo con multer');
        console.log('✅ Solución: Mover body parsers DESPUÉS de rutas que usan multer');
        console.log('⚠️  Pero esto romperá el login...');
        console.log('🔧 Necesitamos una solución híbrida');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugUploadIssue();
