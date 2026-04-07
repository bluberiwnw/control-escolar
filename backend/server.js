const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/materias', require('./routes/materias'));
app.use('/api/actividades', require('./routes/actividades'));
app.use('/api/asistencia', require('./routes/asistencia'));
app.use('/api/calificaciones', require('./routes/calificaciones'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/admin', require('./routes/admin'));

// Servir frontend estático (después de las rutas API)
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});