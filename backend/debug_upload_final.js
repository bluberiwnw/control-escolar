const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Simular exactamente la configuración del servidor
const app = express();

// Configuración de multer exactamente como en el servidor
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 100 * 1024 * 1024, // 100MB
        fieldSize: 100 * 1024 * 1024, // 100MB para campos
        fields: 50, // máximo 50 campos
        files: 5, // máximo 5 archivos
        parts: 55 // máximo 55 partes
    }
});

// Middleware para simular el problema
app.post('/test-upload', upload.single('archivo'), (req, res) => {
    console.log('🔍 TEST UPLOAD - req.file:', req.file ? 'EXISTS' : 'NULL');
    console.log('🔍 TEST UPLOAD - req.body:', req.body ? 'EXISTS' : 'NULL');
    
    if (!req.file) {
        return res.status(400).json({ 
            message: 'No se proporcionó archivo',
            headers: req.headers,
            body: req.body
        });
    }
    
    res.json({ 
        message: 'Archivo recibido correctamente',
        file: req.file,
        body: req.body
    });
});

// Middleware para capturar errores de multer
app.use((error, req, res, next) => {
    console.error('❌ MULTER ERROR:', error);
    res.status(400).json({ 
        message: 'Error en multer: ' + error.message,
        error: error.message,
        code: error.code,
        limit: error.limit
    });
});

const port = 3001;
app.listen(port, () => {
    console.log(`🔍 Servidor de prueba corriendo en http://localhost:${port}`);
    console.log('📋 Para probar:');
    console.log('   curl -X POST http://localhost:3001/test-upload -F "archivo=@test.htm" -F "materia_id=1"');
});
