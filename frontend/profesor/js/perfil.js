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
        // Cargar datos del dashboard para mantener consistencia
        const stats = await apiRequest('/profesores/estadisticas');
        const actividades = await apiRequest('/profesores/actividades');
        const materias = await apiRequest('/materias');

        const pendientes = actividades.filter((a) => !a.entregado).length;
        
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

        // Actualizar estadísticas como en el dashboard
        const kpi = document.getElementById('statsProfesor');
        if (kpi) {
            kpi.innerHTML = `
                <div class="kpi-card kpi-card--violet">
                    <span class="kpi-card__label">Materias</span>
                    <span class="kpi-card__value">${stats.totalMaterias || materias.length}</span>
                </div>
                <div class="kpi-card kpi-card--teal">
                    <span class="kpi-card__label">Alumnos (aprox.)</span>
                    <span class="kpi-card__value">${totalEstudiantes}</span>
                </div>
                <div class="kpi-card kpi-card--amber">
                    <span class="kpi-card__label">Promedio general</span>
                    <span class="kpi-card__value">${Number(stats.promedioGeneral || 0).toFixed(1)}</span>
                </div>
                <div class="kpi-card kpi-card--rose">
                    <span class="kpi-card__label">Tareas pendientes</span>
                    <span class="kpi-card__value">${pendientes}</span>
                </div>`;
        }
        
        // Mantener compatibilidad con elementos existentes por si se usan en otros lugares
        document.getElementById('totalMaterias').textContent = stats.totalMaterias || materias.length || 0;
        document.getElementById('totalEstudiantes').textContent = totalEstudiantes;
        document.getElementById('totalAsistencias').textContent = stats.totalAsistencias || 0;
        
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
