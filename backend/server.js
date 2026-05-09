const express = require('express');
const cors = require('cors');
const path = require('path');
const authController = require('./controllers/authController');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares básicos (que no autentican)
app.use(cors({
    origin: ['https://control-escolar-frontend.onrender.com', 'http://127.0.0.1:5500', 'http://localhost:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

// Servir archivos estáticos del frontend (sin autenticación)
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas que necesitan body parser JSON (login, CRUD, etc.)
app.use('/auth', express.json());
app.use('/auth', express.urlencoded({ extended: true }));
app.use('/auth', require('./routes/auth'));

app.use('/profesor', express.json());
app.use('/profesor', express.urlencoded({ extended: true }));
app.use('/profesor', require('./routes/profesores'));

app.use('/materias', express.json());
app.use('/materias', express.urlencoded({ extended: true }));
app.use('/materias', require('./routes/materias'));

app.use('/actividades', express.json());
app.use('/actividades', express.urlencoded({ extended: true }));
app.use('/actividades', require('./routes/actividades'));

app.use('/asistencia', express.json());
app.use('/asistencia', express.urlencoded({ extended: true }));
app.use('/asistencia', require('./routes/asistencia'));

app.use('/admin', express.json());
app.use('/admin', express.urlencoded({ extended: true }));
app.use('/admin', require('./routes/admin'));

app.use('/alumno', express.json());
app.use('/alumno', express.urlencoded({ extended: true }));
app.use('/alumno', require('./routes/alumno'));

app.use('/qr', express.json());
app.use('/qr', express.urlencoded({ extended: true }));
app.use('/qr', require('./routes/qr'));

// Rutas que usan multer (sin body parser global)
app.use('/calificaciones', require('./routes/calificaciones'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

console.log('✅ Rutas API cargadas correctamente');

// Ruta raíz (solo por si acaso, ya que el estático sirve index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'Ruta API no encontrada' });
});

// Manejador de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    // No exponer detalles del error en producción
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
        message: 'Error en el servidor',
        ...(isDevelopment && { error: err.message, stack: err.stack })
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`);
    console.log(`📁 Frontend disponible en http://0.0.0.0:${PORT}`);
    console.log(`🗂️ Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 Credenciales: profesor@universidad.edu / profesor123`);
});