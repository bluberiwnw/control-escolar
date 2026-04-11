// Configuración de la API (rutas relativas)
window.API_URL = '';

// Función para formatear fechas (global)
function formatearFecha(fechaISO) {
    if (!fechaISO) return 'No definida';
    return new Date(fechaISO).toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

// Función para peticiones autenticadas con spinner opcional
async function apiRequest(endpoint, options = {}, showSpinner = true) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { ...options, headers };
    
    if (showSpinner) mostrarSpinner(true);
    try {
        const response = await fetch(`${window.API_URL}${endpoint}`, config);
        if (response.status === 401) {
            localStorage.clear();
            window.location.href = '/login.html';
            throw new Error('Sesión expirada');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error en la petición');
        return data;
    } finally {
        if (showSpinner) mostrarSpinner(false);
    }
}

// Funciones de spinner
let spinnerElement = null;
function mostrarSpinner(mostrar) {
    if (mostrar) {
        if (!spinnerElement) {
            spinnerElement = document.createElement('div');
            spinnerElement.className = 'spinner-overlay';
            spinnerElement.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(spinnerElement);
        }
        spinnerElement.style.display = 'flex';
    } else {
        if (spinnerElement) spinnerElement.style.display = 'none';
    }
}

// Función para mostrar alertas toast (opcional)
function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    toast.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensaje}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}