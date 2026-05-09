const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

async function testReqBodySimple() {
    try {
        console.log('🧪 TEST: Analizando req.body y req.file (versión simple)...');
        
        // Crear una app de prueba con la misma configuración
        const app = express();
        
        // Configurar CORS
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // Configurar multer igual que en producción
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const dir = path.join(__dirname, 'uploads');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
        });

        const upload = multer({ 
            storage,
            limits: { fileSize: 10 * 1024 * 1024 },
            fileFilter: (req, file, cb) => {
                const allowedMimes = ['text/html', 'text/htm'];
                const allowedExtensions = ['.htm', '.html'];
                const fileExtension = path.extname(file.originalname).toLowerCase();
                
                if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
                    cb(null, true);
                } else {
                    cb(new Error('Solo se permiten archivos HTM/HTML'), false);
                }
            }
        });
        
        // Middleware específico para upload (SIN body parser)
        app.post('/test-upload', upload.single('archivo'), (req, res) => {
            console.log('📡 req.file:', req.file ? 'EXISTS' : 'UNDEFINED');
            console.log('📡 req.body:', req.body ? 'EXISTS' : 'UNDEFINED');
            console.log('📡 req.body tipo:', typeof req.body);
            console.log('📡 req.body contenido:', req.body);
            
            if (!req.file) {
                return res.status(400).json({ message: 'No se proporcionó archivo' });
            }
            
            if (!req.body) {
                return res.status(400).json({ message: 'req.body es undefined' });
            }
            
            if (!req.body.materia_id) {
                return res.status(400).json({ message: 'No se proporcionó materia_id' });
            }
            
            res.status(200).json({ 
                message: 'Upload simulado exitoso',
                file: req.file.originalname,
                body: req.body
            });
        });
        
        // Middleware específico para CRUD (CON body parser)
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        
        app.post('/test-crud', (req, res) => {
            console.log('📡 req.body en CRUD:', req.body ? 'EXISTS' : 'UNDEFINED');
            console.log('📡 req.body tipo:', typeof req.body);
            console.log('📡 req.body contenido:', req.body);
            
            if (!req.body) {
                return res.status(400).json({ message: 'req.body es undefined en CRUD' });
            }
            
            res.status(200).json({ 
                message: 'CRUD simulado exitoso',
                body: req.body
            });
        });
        
        // Iniciar servidor de prueba
        const server = app.listen(3001, () => {
            console.log('🚀 Servidor de prueba iniciado en http://localhost:3001');
        });
        
        // Esperar un momento para que el servidor inicie
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simular petición de upload como la haría el frontend
        console.log('\n1. 📄 Simulando upload...');
        
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2, 9);
        const formData = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="archivo"; filename="test.htm"',
            'Content-Type: text/html',
            '',
            '<html><body>Test HTM</body></html>',
            '',
            `--${boundary}`,
            'Content-Disposition: form-data; name="materia_id"',
            '',
            '3',
            '',
            `--${boundary}--`
        ].join('\r\n');
        
        const uploadResponse = await fetch('http://localhost:3001/test-upload', {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(formData)
            },
            body: formData
        });
        
        const uploadResult = await uploadResponse.json();
        console.log('📡 Resultado upload:', uploadResult);
        
        // Simular petición CRUD como la haría el frontend
        console.log('\n2. 👥 Simulando CRUD...');
        const crudData = {
            materia_id: '3',
            matricula: '2021-1022',
            nombre: 'Juan Carlos Perez Gomez',
            email: 'juan.perez@estudiante.edu'
        };
        
        const crudResponse = await fetch('http://localhost:3001/test-crud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(crudData)
        });
        
        const crudResult = await crudResponse.json();
        console.log('📡 Resultado CRUD:', crudResult);
        
        // Cerrar servidor de prueba
        server.close();
        
        console.log('\n🎯 Análisis completado');
        
    } catch (error) {
        console.error('❌ Error en test:', error.message);
    }
}

testReqBodySimple();
