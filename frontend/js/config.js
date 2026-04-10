// Configuración de la API - usa rutas relativas (mismo origen)
window.API_URL = '';  // Vacío para que las peticiones sean relativas

// Función para peticiones autenticadas
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { ...options, headers };
    // Usa endpoint directamente (sin concatenar API_URL)
    const response = await fetch(endpoint, config);
    if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/login.html';
        throw new Error('Sesión expirada');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error en la petición');
    return data;
}