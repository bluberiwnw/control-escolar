// auth.js - Versión completa

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://control-escolar-l3g0.onrender.com';

  
// Función para mostrar alertas
function mostrarAlerta(mensaje, tipo = 'info') {
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

// Función para obtener usuario actual desde localStorage
function obtenerUsuarioActual() {
    const usuarioStr = localStorage.getItem('usuarioActual');
    return usuarioStr ? JSON.parse(usuarioStr) : null;
}

// Función para verificar sesión (redirige si no hay usuario)
function verificarSesion() {
    const usuario = obtenerUsuarioActual();
    const isLoginPage = window.location.href.includes('login.html');
    
    if (!usuario) {
        // Solo redirigir si NO estamos en login.html
        if (!isLoginPage) {
            window.location.href = 'login.html';
        }
        return null;
    }
    return usuario;
}

// Función para cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuarioActual');
    localStorage.removeItem('materiasProfesor');
    window.location.href = 'login.html';
}

// Función para mostrar info del usuario en la interfaz
function mostrarInfoUsuario() {
    const usuario = obtenerUsuarioActual();
    if (usuario) {
        const teacherName = document.getElementById('teacherName');
        const teacherEmail = document.getElementById('teacherEmail');
        const teacherAvatar = document.getElementById('teacherAvatar');
        if (teacherName) teacherName.textContent = usuario.nombre;
        if (teacherEmail) teacherEmail.textContent = usuario.email;
        if (teacherAvatar) teacherAvatar.innerHTML = '<i class="fas fa-chalkboard-teacher"></i>';
    }
}

// Función para mostrar fecha actual
function mostrarFechaActual() {
    const fechaElement = document.getElementById('fechaActualCompleta');
    if (fechaElement) {
        const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        fechaElement.textContent = new Date().toLocaleDateString('es-ES', opciones);
    }
}

// Manejar el login
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('usuarioActual', JSON.stringify(data.profesor));
            // Cargar materias del profesor
            const materiasRes = await fetch(`${API_URL}/profesores/materias`, {
                headers: { 'Authorization': `Bearer ${data.token}` }
            });
            if (materiasRes.ok) {
                const materias = await materiasRes.json();
                localStorage.setItem('materiasProfesor', JSON.stringify(materias));
            }
            window.location.href = 'dashboard.html';
        } else {
            mostrarAlerta(data.message || 'Credenciales incorrectas', 'error');
        }
    } catch (error) {
        mostrarAlerta('Error de conexión con el servidor', 'error');
        console.error(error);
    }
}

function cerrarSesion() {
    console.log('Cerrando sesión...');
    localStorage.removeItem('token');
    localStorage.removeItem('usuarioActual');
    localStorage.removeItem('materiasProfesor');
    window.location.href = 'login.html';
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