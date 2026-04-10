const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(cors({
    origin: ['https://control-escolar-frontend.onrender.com', 'http://127.0.0.1:5500', 'http://localhost:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Servir archivos estáticos del frontend (desde la carpeta 'frontend')
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas (con try/catch para evitar que errores de importación detengan todo)
try {
    app.use('/auth', require('./routes/auth'));
    app.use('/profesores', require('./routes/profesores'));
    app.use('/materias', require('./routes/materias'));
    app.use('/actividades', require('./routes/actividades'));
    app.use('/asistencia', require('./routes/asistencia'));
    app.use('/calificaciones', require('./routes/calificaciones'));
    app.use('/admin', require('./routes/admin'));
    app.use('/alumno', require('./routes/alumno'));
    console.log('✅ Rutas cargadas correctamente');
} catch (err) {
    console.error('❌ Error cargando rutas:', err.message);
    process.exit(1);
}

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ message: 'API del Portal del Profesor - BUAP', version: '1.0.0' });
});

// Manejador de errores 404
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejador de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Error en el servidor', error: err.message });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`);
    console.log(`🔑 Credenciales: profesor@universidad.edu / profesor123`);
}).on('error', (err) => {
    console.error('❌ Error al iniciar el servidor:', err);
    process.exit(1);
});

