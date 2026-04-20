const API_URL = window.API_URL;

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const response = await fetch(`${window.API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('usuarioActual', JSON.stringify(data.usuario));
            if (data.usuario.rol === 'administrador') {
                window.location.href = 'admin/dashboard.html';
            } else if (data.usuario.rol === 'profesor') {
                window.location.href = 'profesor/dashboard.html';
            } else {
                window.location.href = 'alumno/dashboard.html';
            }
        } else {
            mostrarAlerta(data.message || 'Credenciales incorrectas', 'error');
        }
    } catch (error) {
        mostrarAlerta('Error de conexión', 'error');
    }
}

function mostrarAlerta(mensaje, tipo) {
    const alertContainer = document.getElementById('alertContainer');
    if (alertContainer) {
        alertContainer.textContent = mensaje;
        alertContainer.className = `alert alert-${tipo}`;
        alertContainer.style.display = 'block';
        setTimeout(() => {
            alertContainer.style.display = 'none';
        }, 3000);
    } else {
        alert(mensaje);
    }
}

function mostrarModalReestablecer() {
    document.getElementById('modalReestablecer').style.display = 'flex';
    document.getElementById('emailReestablecer').focus();
}

function cerrarModalReestablecer() {
    document.getElementById('modalReestablecer').style.display = 'none';
    document.getElementById('emailReestablecer').value = '';
}

async function handleReestablecer(event) {
    event.preventDefault();
    const email = document.getElementById('emailReestablecer').value.trim();
    
    if (!email) {
        mostrarAlerta('Por favor ingresa tu correo electrónico', 'error');
        return;
    }
    
    if (!email.includes('@')) {
        mostrarAlerta('Por favor ingresa un correo electrónico válido', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${window.API_URL}/auth/reestablecer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        
        const data = await response.json();
        if (response.ok) {
            mostrarAlerta('Se ha enviado un correo con instrucciones para reestablecer tu contraseña', 'success');
            cerrarModalReestablecer();
        } else {
            mostrarAlerta(data.message || 'No se pudo procesar la solicitud', 'error');
        }
    } catch (error) {
        mostrarAlerta('Error de conexión', 'error');
    }
}

function verificarSesion() {
    const raw = localStorage.getItem('usuarioActual');
    if (!raw) {
        window.location.href = '/login.html';
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch {
        window.location.href = '/login.html';
        return null;
    }
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = '/login.html';
}

function mostrarInfoUsuario() {
    const raw = localStorage.getItem('usuarioActual');
    if (!raw) return;
    let usuario;
    try {
        usuario = JSON.parse(raw);
    } catch {
        return;
    }
    const nameTargets = ['userName', 'teacherName'];
    const emailTargets = ['userEmail', 'teacherEmail'];
    nameTargets.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = usuario.nombre || '';
    });
    emailTargets.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = usuario.email || '';
    });
}

function mostrarFechaActual() {
    const fechaElem = document.getElementById('fechaActualCompleta');
    if (fechaElem) {
        const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        fechaElem.textContent = new Date().toLocaleDateString('es-ES', opciones);
    }
}

function updateThemeIcons() {
    const dark = document.body.classList.contains('dark');
    document.querySelectorAll('[data-theme-icon]').forEach((btn) => {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
        }
    });
}

function applyTheme() {
    const dark = localStorage.getItem('theme') === 'dark';
    document.body.classList.toggle('dark', dark);
    document.body.classList.toggle('dark-mode', dark);
    updateThemeIcons();
}

function toggleTheme() {
    const next = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', next);
    document.body.classList.toggle('dark-mode', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    updateThemeIcons();
    window.dispatchEvent(new Event('themechange'));
}

/**
 * Misma estructura de menú en todos los roles: solo se ocultan ítems según permisos.
 * Profesor: sin Reportes ni Usuarios. Alumno: sin Usuarios.
 */
function applyRoleNav() {
    const raw = localStorage.getItem('usuarioActual');
    if (!raw) return;
    let usuario;
    try {
        usuario = JSON.parse(raw);
    } catch {
        return;
    }
    const usuarios = document.querySelector('[data-nav="usuarios"]');
    const reportes = document.querySelector('[data-nav="reportes"]');
    if (usuarios) {
        usuarios.classList.toggle('nav-item--hidden', usuario.rol !== 'administrador');
    }
    if (reportes) {
        reportes.classList.toggle('nav-item--hidden', usuario.rol === 'profesor');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();

    const path = window.location.pathname || '';
    const isLoginPage = path.endsWith('login.html') || path.endsWith('/login.html');
    const isLanding = path.endsWith('/') || path.endsWith('index.html') || /index\.html$/i.test(path);

    if (isLanding || path.includes('index.html')) {
        return;
    }

    if (isLoginPage) {
        applyTheme();
        updateThemeIcons();
        return;
    }

    const usuario = verificarSesion();
    if (!usuario) return;

    mostrarInfoUsuario();
    mostrarFechaActual();
    applyRoleNav();
});

window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;
window.applyRoleNav = applyRoleNav;
