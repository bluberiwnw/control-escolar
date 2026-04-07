const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

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

// Rutas
app.use('/auth', require('./routes/auth'));
app.use('/profesores', require('./routes/profesores'));
app.use('/materias', require('./routes/materias'));
app.use('/actividades', require('./routes/actividades'));
app.use('/asistencia', require('./routes/asistencia'));
app.use('/calificaciones', require('./routes/calificaciones'));

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ message: 'API del Portal del Profesor - BUAP', version: '1.0.0', endpoints: { auth: '/auth', profesores: '/profesores', materias: '/materias', actividades: '/actividades', asistencia: '/asistencia', calificaciones: '/calificaciones' } });
});

// Manejo de errores
app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Error en el servidor', error: err.message });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`);
    console.log(`📚 Documentación disponible en http://0.0.0.0:${PORT}`);
    console.log(`🔑 Credenciales: profesor@universidad.edu / profesor123`);
});