window.API_URL = '';

function formatearFecha(fechaISO) {
    if (!fechaISO) return 'No definida';
    return new Date(fechaISO).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

async function apiRequest(endpoint, options = {}, showSpinner = true) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { ...options, headers };

    if (showSpinner) mostrarSpinner(true);
    try {
        const response = await fetch(`${window.API_URL}${endpoint}`, config);
        const ct = response.headers.get('content-type') || '';
        let data = {};
        if (ct.includes('application/json')) {
            const text = await response.text();
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    data = { message: text };
                }
            }
        } else {
            const text = await response.text();
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    data = { message: text };
                }
            }
        }

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = '/login.html';
            throw new Error(data.message || 'Sesión expirada');
        }
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Error en la petición');
        }
        return data;
    } finally {
        if (showSpinner) mostrarSpinner(false);
    }
}

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
    } else if (spinnerElement) {
        spinnerElement.style.display = 'none';
    }
}

function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    toast.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensaje}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function chartTextColor() {
    const dark = document.body.classList.contains('dark') || document.body.classList.contains('dark-mode');
    return dark ? '#e2e8f0' : '#334155';
}

function chartGridColor() {
    const dark = document.body.classList.contains('dark') || document.body.classList.contains('dark-mode');
    return dark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.06)';
}
