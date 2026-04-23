document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarDatosPerfil();
    await cargarEstadisticasAdmin();
    
    // Configurar formulario de cambio de contraseña
    const form = document.getElementById('formCambiarContrasena');
    if (form) {
        form.addEventListener('submit', handleCambiarContrasena);
    }
});

async function cargarDatosPerfil() {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuarioActual'));
        if (!usuario) {
            mostrarToast('No se encontró información del usuario', 'error');
            return;
        }

        // Actualizar información del perfil
        document.getElementById('profileNombre').textContent = usuario.nombre || 'No disponible';
        document.getElementById('profileEmail').textContent = usuario.email || 'No disponible';
        document.getElementById('profileDepartamento').textContent = usuario.departamento || 'Sistemas Escolares';
        
        // Actualizar información del sidebar
        document.getElementById('userName').textContent = usuario.nombre || 'Administrador';
        document.getElementById('userEmail').textContent = usuario.email || '';
        
    } catch (error) {
        console.error('Error al cargar datos del perfil:', error);
        mostrarToast('Error al cargar información del perfil', 'error');
    }
}

async function cargarEstadisticasAdmin() {
    try {
        // Cargar datos del dashboard para mantener consistencia
        const stats = await apiRequest('/admin/stats');
        const profesores = await apiRequest('/admin/usuarios?rol=profesor');
        const estudiantes = await apiRequest('/admin/usuarios?rol=alumno');
        const materias = await apiRequest('/materias');
        const pendientes = stats.actividades || 0;

        // Actualizar estadísticas como en el dashboard
        const kpi = document.getElementById('statsAdmin');
        if (kpi) {
            kpi.innerHTML = `
                <div class="kpi-card kpi-card--violet">
                    <span class="kpi-card__label">Estudiantes</span>
                    <span class="kpi-card__value">${stats.estudiantes}</span>
                </div>
                <div class="kpi-card kpi-card--teal">
                    <span class="kpi-card__label">Materias activas</span>
                    <span class="kpi-card__value">${stats.materias}</span>
                </div>
                <div class="kpi-card kpi-card--amber">
                    <span class="kpi-card__label">Actividades</span>
                    <span class="kpi-card__value">${pendientes}</span>
                </div>
                <div class="kpi-card kpi-card--rose">
                    <span class="kpi-card__label">Profesores</span>
                    <span class="kpi-card__value">${stats.profesores}</span>
                </div>`;
        }
        
        // Mantener compatibilidad con elementos existentes por si se usan en otros lugares
        document.getElementById('totalProfesores').textContent = stats.profesores || profesores.length || 0;
        document.getElementById('totalEstudiantes').textContent = stats.estudiantes || estudiantes.length || 0;
        document.getElementById('totalMaterias').textContent = stats.materias || materias.length || 0;
        document.getElementById('totalUsuarios').textContent = (stats.profesores + stats.estudiantes) || (profesores.length + estudiantes.length) || 0;
        
    } catch (error) {
        console.error('Error al cargar estadísticas administrativas:', error);
        // Establecer valores por defecto en caso de error
        document.getElementById('totalProfesores').textContent = '0';
        document.getElementById('totalEstudiantes').textContent = '0';
        document.getElementById('totalMaterias').textContent = '0';
        document.getElementById('totalUsuarios').textContent = '0';
    }
}

async function handleCambiarContrasena(event) {
    event.preventDefault();
    
    const contrasenaActual = document.getElementById('contrasenaActual').value;
    const contrasenaNueva = document.getElementById('contrasenaNueva').value;
    const contrasenaConfirmar = document.getElementById('contrasenaConfirmar').value;
    
    // Validaciones
    if (!contrasenaActual || !contrasenaNueva || !contrasenaConfirmar) {
        mostrarToast('Todos los campos son obligatorios', 'error');
        return;
    }
    
    if (contrasenaNueva.length < 6) {
        mostrarToast('La nueva contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    if (contrasenaNueva !== contrasenaConfirmar) {
        mostrarToast('Las contraseñas nuevas no coinciden', 'error');
        return;
    }
    
    if (contrasenaActual === contrasenaNueva) {
        mostrarToast('La nueva contraseña debe ser diferente a la actual', 'error');
        return;
    }
    
    // Validación de fortaleza de contraseña
    const tieneMayuscula = /[A-Z]/.test(contrasenaNueva);
    const tieneMinuscula = /[a-z]/.test(contrasenaNueva);
    const tieneNumero = /\d/.test(contrasenaNueva);
    
    if (!tieneMayuscula || !tieneMinuscula || !tieneNumero) {
        mostrarToast('La contraseña debe incluir mayúsculas, minúsculas y números', 'error');
        return;
    }
    
    try {
        // Deshabilitar botón del formulario
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        
        const usuario = JSON.parse(localStorage.getItem('usuarioActual'));
        
        const response = await apiRequest('/auth/cambiar-contrasena', {
            method: 'POST',
            body: JSON.stringify({
                email: usuario.email,
                contrasenaActual,
                contrasenaNueva
            })
        });
        
        mostrarToast('Contraseña actualizada correctamente', 'success');
        
        // Limpiar formulario
        event.target.reset();
        
        // Mostrar mensaje de seguridad
        setTimeout(() => {
            mostrarToast('Por seguridad, cierra sesión y vuelve a ingresar con tu nueva contraseña', 'info');
        }, 2000);
        
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        
        let mensajeError = 'No se pudo cambiar la contraseña';
        
        if (error.message.includes('401')) {
            mensajeError = 'La contraseña actual es incorrecta';
        } else if (error.message.includes('400')) {
            mensajeError = 'La contraseña nueva no cumple los requisitos de seguridad';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            mensajeError = 'Error de conexión. Verifica tu internet e intenta de nuevo';
        }
        
        mostrarToast(mensajeError, 'error');
    } finally {
        // Restaurar botón
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Contraseña';
    }
}

// Función para mostrar/ocultar contraseña (opcional)
function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}
