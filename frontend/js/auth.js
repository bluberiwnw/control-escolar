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
    
    // Validación más robusta de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        mostrarAlerta('Por favor ingresa un correo electrónico válido', 'error');
        return;
    }
    
    // Deshabilitar botón para evitar múltiples envíos
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    try {
        const response = await fetch(`${window.API_URL}/auth/reestablecer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Modo desarrollo: mostrar contraseña temporal de forma segura
            if (data.debug && data.debug.tempPassword) {
                // Limpiar cualquier contraseña temporal anterior
                const existingTemp = document.querySelector('.temp-password-display');
                if (existingTemp) existingTemp.remove();
                
                const tempPassDiv = document.createElement('div');
                tempPassDiv.className = 'temp-password-display';
                tempPassDiv.style.cssText = `
                    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                    border: 2px solid #0ea5e9;
                    color: #0369a1;
                    padding: 20px;
                    border-radius: 12px;
                    margin: 16px 0;
                    font-weight: 600;
                    text-align: center;
                    font-size: 1.1rem;
                    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
                `;
                tempPassDiv.innerHTML = `
                    <div style="margin-bottom: 12px; font-size: 0.9rem; color: #64748b;">
                        <i class="fas fa-shield-alt"></i> Contraseña Temporal Generada
                    </div>
                    <div style="font-family: 'Courier New', monospace; font-size: 1.4rem; letter-spacing: 3px; 
                                background: white; padding: 12px; border-radius: 8px; margin: 8px 0;
                                border: 1px solid #cbd5e1; color: #1e40af;">
                        ${data.debug.tempPassword}
                    </div>
                    <div style="margin-top: 16px; font-size: 0.85rem; color: #64748b; line-height: 1.4;">
                        <strong>Instrucciones de seguridad:</strong><br>
                        1. Copia esta contraseña<br>
                        2. Inicia sesión inmediatamente<br>
                        3. Cambia la contraseña en tu perfil<br>
                        4. Esta contraseña expira en 30 minutos
                    </div>
                    <button type="button" onclick="navigator.clipboard.writeText('${data.debug.tempPassword}'); 
                           this.innerHTML='¡Copiado!'; this.style.background='#10b981'; this.style.color='white';"
                           style="margin-top: 12px; padding: 8px 16px; background: #0ea5e9; color: white; 
                                  border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-copy"></i> Copiar contraseña
                    </button>
                `;
                
                // Insertar después del formulario
                const form = document.querySelector('#modalReestablecer form');
                form.parentNode.insertBefore(tempPassDiv, form.nextSibling);
                
                mostrarAlerta('Contraseña temporal generada. Revisa las instrucciones de seguridad.', 'success');
            } else {
                // Modo producción: mensaje estándar
                mostrarAlerta('Se ha enviado un correo con instrucciones seguras para reestablecer tu contraseña. El enlace expirará en 30 minutos.', 'success');
                cerrarModalReestablecer();
            }
        } else {
            mostrarAlerta(data.message || 'No se pudo procesar la solicitud. Verifica que el correo esté registrado.', 'error');
        }
    } catch (error) {
        console.error('Error al reestablecer contraseña:', error);
        mostrarAlerta('Error de conexión. Verifica tu internet e intenta más tarde.', 'error');
    } finally {
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
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
