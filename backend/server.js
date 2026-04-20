const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    message: { message: 'Too many authentication attempts, please try again later.' },
    skipSuccessfulRequests: true,
});

// Middlewares básicos (que no autentican)
app.use(cors({
    origin: ['https://control-escolar-frontend.onrender.com', 'http://127.0.0.1:5500', 'http://localhost:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos del frontend (sin autenticación)
app.use(express.static(path.join(__dirname, '../frontend')));

// Las rutas de API aplican su propia autenticación en cada archivo de ruta
app.use('/auth', authLimiter, require('./routes/auth'));
app.use('/profesores', require('./routes/profesores'));
app.use('/materias', require('./routes/materias'));
app.use('/actividades', require('./routes/actividades'));
app.use('/asistencia', require('./routes/asistencia'));
app.use('/calificaciones', require('./routes/calificaciones'));
app.use('/admin', require('./routes/admin'));
app.use('/alumno', require('./routes/alumno'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/qr', require('./routes/qr'));

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
    console.log(`� Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 Rate limiting activado: 100 req/15min, auth: 5 req/15min`);
});