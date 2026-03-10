// Configuración de la API
const API_URL = 'http://locacontrol-escolar-production-3bca.up.railway.applhost:8000';

// Función helper para hacer peticiones autenticadas
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers
    };
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        
        if (response.status === 401) {
            // Token expirado o inválido
            localStorage.removeItem('token');
            localStorage.removeItem('usuarioActual');
            window.location.href = 'login.html';
            throw new Error('Sesión expirada');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error en la petición');
        }
        
        return data;
        
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}