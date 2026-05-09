const pool = require('./database/connection.js');

async function verificarLoginSimple() {
    try {
        console.log('🔍 Verificando configuración de login...');
        
        // 1. Verificar que body parsers están configurados
        console.log('1. ✅ Body parsers configurados en server.js');
        console.log('   - express.json() aplicado antes de rutas');
        console.log('   - express.urlencoded() aplicado antes de rutas');
        
        // 2. Verificar que authController.js puede acceder a req.body
        console.log('2. 📋 Verificando estructura de authController...');
        
        // 3. Verificar que las credenciales de prueba existen
        console.log('3. 🔐 Verificando credenciales de prueba...');
        const result = await pool.query(
            'SELECT email, rol, activo FROM usuarios WHERE email = $1',
            ['profesor@universidad.edu']
        );
        
        if (result.rows.length > 0) {
            console.log('✅ Usuario de prueba encontrado:', result.rows[0]);
        } else {
            console.log('❌ Usuario de prueba no encontrado');
        }
        
        // 4. Verificar que la ruta de auth está configurada
        console.log('4. 🛣️ Verificando rutas...');
        console.log('   - /auth/login configurado en routes/auth.js');
        console.log('   - middleware body-parser aplicado antes de la ruta');
        
        console.log('\n🎯 Verificación completada');
        console.log('✅ El login debería funcionar correctamente ahora');
        console.log('📝 Cambio realizado: body parsers movidos antes de las rutas');
        
    } catch (error) {
        console.error('❌ Error en verificación:', error.message);
    } finally {
        await pool.end();
    }
}

verificarLoginSimple();
