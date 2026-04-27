(function initApiBaseUrl() {
    if (typeof window === 'undefined') return;
    if (String(window.API_URL || '').trim()) return;
    const meta = document.querySelector?.('meta[name="api-base"]');
    if (meta?.content?.trim()) {
        window.API_URL = meta.content.trim().replace(/\/$/, '');
        return;
    }
    try {
        const ls = localStorage.getItem('API_BASE_URL');
        if (ls?.trim()) {
            window.API_URL = ls.trim().replace(/\/$/, '');
            return;
        }
    } catch (_) {
        /* ignore */
    }
    const loc = window.location;
    const port = loc.port;
    const host = loc.hostname;
    if (
        (host === 'localhost' || host === '127.0.0.1') &&
        ['5500', '5501', '8080', '4173', '3000'].includes(String(port))
    ) {
        window.API_URL = `${loc.protocol}//${host}:8000`;
    }
})();

window.API_URL = String(window.API_URL || '').replace(/\/$/, '');

function buildApiUrl(pathname = '') {
    const base = (window.API_URL || '').trim();
    const path = String(pathname || '').trim();
    if (!path) return base;
    if (/^https?:\/\//i.test(path)) return path;
    if (!base) return path;
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
}

window.buildApiUrl = buildApiUrl;

/**
 * Descarga un archivo de la API con el token (evita fallos con enlaces directos a /uploads).
 */
async function descargarConAuth(urlPath, nombreSugerido) {
    const token = localStorage.getItem('token');
    const url = buildApiUrl(urlPath);
    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/octet-stream, application/json, */*',
            },
        });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) {
            let msg = 'No se pudo descargar el archivo';
            if (ct.includes('application/json')) {
                try {
                    const err = await res.json();
                    msg = err.message || err.error || msg;
                } catch (_) {
                    /* ignore */
                }
            }
            mostrarToast(msg, 'error');
            return;
        }
        if (ct.includes('application/json')) {
            try {
                const err = await res.json();
                mostrarToast(err.message || err.error || 'Respuesta inesperada', 'error');
            } catch (_) {
                mostrarToast('No se pudo descargar el archivo', 'error');
            }
            return;
        }
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') || '';
        let nombre = nombreSugerido || 'archivo';
        const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        if (m && m[1]) nombre = decodeURIComponent(m[1].trim());
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    } catch (_) {
        mostrarToast('Error de red al descargar. Si usas Live Server, configura la URL del API (meta api-base o API_BASE_URL en localStorage).', 'error');
    }
}

window.descargarConAuth = descargarConAuth;

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-auth-download]');
    if (!btn) return;
    e.preventDefault();
    const path = btn.getAttribute('data-auth-download');
    const name = btn.getAttribute('data-download-name') || 'archivo';
    if (!path) return;
    descargarConAuth(path, name);
});

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
        const base = (window.API_URL || '').trim();
        const response = await fetch(`${base}${endpoint}`, config);
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
    setTimeout(() => toast.remove(), 4500);
}

function chartTextColor() {
    const dark = document.body.classList.contains('dark') || document.body.classList.contains('dark-mode');
    return dark ? '#e2e8f0' : '#334155';
}

function chartGridColor() {
    const dark = document.body.classList.contains('dark') || document.body.classList.contains('dark-mode');
    return dark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.06)';
}
