const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares
/*app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
    credentials: true
}));*/
app.use(cors({
    origin: ['vmline.netlify.app', 'http://localhost:5500'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas
app.use('/auth', require('./routes/auth'));
app.use('/profesores', require('./routes/profesores'));
app.use('/materias', require('./routes/materias'));
app.use('/actividades', require('./routes/actividades'));
app.use('/asistencia', require('./routes/asistencia'));
app.use('/calificaciones', require('./routes/calificaciones'));

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        message: 'API del Portal del Profesor - BUAP',
        version: '1.0.0',
        endpoints: {
            auth: '/auth',
            profesores: '/profesores',
            materias: '/materias',
            actividades: '/actividades',
            asistencia: '/asistencia',
            calificaciones: '/calificaciones'
        }
    });
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Error en el servidor', error: err.message });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📚 Documentación disponible en http://localhost:${PORT}`);
    console.log(`🔑 Credenciales: profesor@universidad.edu / profesor123`);
});

