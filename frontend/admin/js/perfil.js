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
    // Las estadísticas han sido eliminadas del perfil del admin
    // Solo mantenemos compatibilidad con elementos existentes
    try {
        const statsContainer = document.getElementById('statsAdmin');
        if (statsContainer) {
            statsContainer.innerHTML = '';
            statsContainer.style.display = 'none';
        }
        
        // Establecer valores por defecto para compatibilidad
        const totalProfesores = document.getElementById('totalProfesores');
        const totalEstudiantes = document.getElementById('totalEstudiantes');
        const totalMaterias = document.getElementById('totalMaterias');
        const totalUsuarios = document.getElementById('totalUsuarios');
        
        if (totalProfesores) totalProfesores.textContent = '0';
        if (totalEstudiantes) totalEstudiantes.textContent = '0';
        if (totalMaterias) totalMaterias.textContent = '0';
        if (totalUsuarios) totalUsuarios.textContent = '0';
        
    } catch (error) {
        console.error('Error al limpiar estadísticas administrativas:', error);
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
