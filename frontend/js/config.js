// Configuración de la API
window.API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : 'https://control-escolar-l3g0.onrender.com';

// Función para peticiones autenticadas
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { ...options, headers };
    const response = await fetch(`${window.API_URL}${endpoint}`, config);
    if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/login.html';
        throw new Error('Sesión expirada');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error en la petición');
    return data;
}