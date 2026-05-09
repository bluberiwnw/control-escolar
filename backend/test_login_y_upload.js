const express = require('express');
const request = require('supertest');
const app = require('./server.js');

async function testLoginYUpload() {
    try {
        console.log('🧪 Probando login y upload simultáneamente...');
        
        // 1. Probar login
        console.log('1. 🔐 Probando login...');
        const loginResponse = await request(app)
            .post('/auth/login')
            .send({
                email: 'profesor@universidad.edu',
                password: 'profesor123'
            });
        
        if (loginResponse.status === 200) {
            console.log('✅ Login exitoso');
            const token = loginResponse.body.token;
            
            // 2. Probar upload con FormData
            console.log('2. 📄 Probando upload de archivo...');
            
            const formData = new FormData();
            formData.append('archivo', new Blob(['<html><body>Test HTM</body></html>'], { type: 'text/html' }), 'test.htm');
            formData.append('materia_id', '1');
            
            const uploadResponse = await request(app)
                .post('/calificaciones/upload')
                .set('Authorization', `Bearer ${token}`)
                .send(formData);
            
            console.log('📡 Upload response:', uploadResponse.status);
            
            if (uploadResponse.status === 200) {
                console.log('✅ Upload exitoso');
            } else {
                console.log('❌ Upload falló:', uploadResponse.body);
            }
            
        } else {
            console.log('❌ Login falló:', loginResponse.body);
        }
        
        console.log('\n🎯 Prueba completada');
        
    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
    }
}

// Esta prueba requiere supertest, pero podemos hacer una simulación simple
testLoginYUpload();
