/*const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://control-escolar-l3g0.onrender.com';*/

const API_URL = window.API_URL; 

// Función de login
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const response = await fetch(`${window.API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('usuarioActual', JSON.stringify(data.usuario));
            console.log('Token guardado:', data.token); 
            // Redirigir según rol
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
        setTimeout(() => { alertContainer.style.display = 'none'; }, 3000);
    } else {
        alert(mensaje);
    }
}

function verificarSesion() {
    const usuario = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!usuario) {
        window.location.href = '/login.html';
        return null;
    }
    return usuario;
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = '/login.html';
}

function mostrarInfoUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuarioActual'));
    if (usuario) {
        const nombreElem = document.getElementById('teacherName');
        const emailElem = document.getElementById('teacherEmail');
        if (nombreElem) nombreElem.textContent = usuario.nombre;
        if (emailElem) emailElem.textContent = usuario.email;
    }
}

function mostrarFechaActual() {
    const fechaElem = document.getElementById('fechaActualCompleta');
    if (fechaElem) {
        const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        fechaElem.textContent = new Date().toLocaleDateString('es-ES', opciones);
    }
}

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Detectar si estamos en la página de login
    const isLoginPage = window.location.pathname.endsWith('login.html') || 
                        window.location.pathname === '/';
    
    if (isLoginPage) {
        // Si es login, no hacemos nada (el formulario ya está listo)
        return;
    }
    
    // Para cualquier otra página, verificamos sesión
    const usuario = verificarSesion();
    if (usuario) {
        mostrarInfoUsuario();
        mostrarFechaActual();
    }
});