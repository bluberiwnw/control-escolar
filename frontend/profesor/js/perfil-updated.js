document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarDatosPerfil();
    await cargarEstadisticasDocentes();
    
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
        document.getElementById('profileDepartamento').textContent = usuario.departamento || 'No especificado';
        
        // Actualizar información del sidebar
        document.getElementById('teacherName').textContent = usuario.nombre || 'Profesor';
        document.getElementById('teacherEmail').textContent = usuario.email || '';
        
    } catch (error) {
        console.error('Error al cargar datos del perfil:', error);
        mostrarToast('Error al cargar información del perfil', 'error');
    }
}

async function cargarEstadisticasDocentes() {
    try {
        // Cargar materias del profesor
        const materias = await apiRequest('/materias');
        document.getElementById('totalMaterias').textContent = materias.length || 0;
        
        // Calcular total de estudiantes
        let totalEstudiantes = 0;
        for (const materia of materias) {
            try {
                const estudiantes = await apiRequest(`/materias/${materia.id}/estudiantes-inscritos`);
                totalEstudiantes += estudiantes.length || 0;
            } catch (error) {
                console.error(`Error al cargar estudiantes de materia ${materia.id}:`, error);
            }
        }
        document.getElementById('totalEstudiantes').textContent = totalEstudiantes;
        
        // Cargar estadísticas de asistencia (simplificado)
        let totalAsistencias = 0;
        for (const materia of materias) {
            try {
                // Obtener asistencias del último mes
                const fechaActual = new Date();
                const fechaMesPasado = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, fechaActual.getDate());
                const fechaStr = fechaMesPasado.toISOString().split('T')[0];
                
                const asistencias = await apiRequest(`/asistencia/${materia.id}/${fechaStr}`);
                totalAsistencias += asistencias.length || 0;
            } catch (error) {
                console.error(`Error al cargar asistencias de materia ${materia.id}:`, error);
            }
        }
        document.getElementById('totalAsistencias').textContent = totalAsistencias;
        
    } catch (error) {
        console.error('Error al cargar estadísticas docentes:', error);
        // Establecer valores por defecto en caso de error
        document.getElementById('totalMaterias').textContent = '0';
        document.getElementById('totalEstudiantes').textContent = '0';
        document.getElementById('totalAsistencias').textContent = '0';
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
