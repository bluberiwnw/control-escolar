document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); 
    mostrarInfoUsuario(); 
    mostrarFechaActual();
    await cargarCalificaciones();
    await cargarMateriasParaBaja();
});

async function cargarCalificaciones() {
    try {
        mostrarToast('Cargando calificaciones...', 'info');
        
        const data = await apiRequest('/calificaciones/alumno/todas');
        
        if (!data.materias || data.materias.length === 0) {
            mostrarResumenVacio();
            document.getElementById('calificacionesContainer').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-graduation-cap" style="font-size: 3rem; color: #94a3b8; margin-bottom: 1rem;"></i>
                    <h3>No hay calificaciones registradas</h3>
                    <p>Tus calificaciones aparecerán aquí cuando tus profesores las registren.</p>
                </div>
            `;
            return;
        }

        // Actualizar resumen general
        actualizarResumenGeneral(data);
        
        // Mostrar calificaciones por materia
        mostrarCalificacionesPorMateria(data.materias);
        
        mostrarToast('Calificaciones cargadas exitosamente', 'success');
    } catch (error) {
        console.error('Error al cargar calificaciones:', error);
        document.getElementById('calificacionesContainer').innerHTML = `
            <div class="alert alert-error">
                <i class="fas fa-exclamation-triangle"></i>
                Error al cargar calificaciones. Inténtalo nuevamente.
            </div>
        `;
    }
}

function mostrarResumenVacio() {
    document.getElementById('promedioGeneral').textContent = '0.0';
    document.getElementById('totalMaterias').textContent = '0';
    document.getElementById('materiasAprobadas').textContent = '0';
}

function actualizarResumenGeneral(data) {
    // Calcular promedio general correctamente
    const promedioGeneral = data.materias && data.materias.length > 0 
        ? data.materias.reduce((sum, m) => sum + (m.promedio_final || 0), 0) / data.materias.length 
        : 0;
    
    document.getElementById('promedioGeneral').textContent = promedioGeneral.toFixed(1);
    document.getElementById('totalMaterias').textContent = data.total_materias || data.materias?.length || 0;
    
    const aprobadas = data.materias ? data.materias.filter(m => (m.promedio_final || 0) >= 6).length : 0;
    document.getElementById('materiasAprobadas').textContent = aprobadas;
    
    // Actualizar el círculo de promedio con color dinámico
    const promedioCircle = document.querySelector('.stat-circle');
    if (promedioCircle) {
        promedioCircle.style.background = getPromedioColor(promedioGeneral);
    }
}

function getPromedioColor(promedio) {
    if (promedio >= 9) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    if (promedio >= 8) return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    if (promedio >= 7) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    if (promedio >= 6) return 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
}

function mostrarCalificacionesPorMateria(materias) {
    const container = document.getElementById('calificacionesContainer');
    
    let html = '';
    materias.forEach(materia => {
        const promedioColor = getCalificacionColor(materia.promedio_final);
        const promedioIcon = getCalificacionIcon(materia.promedio_final);
            
        html += `
            <div class="materia-card">
                <div class="materia-header">
                    <div class="materia-info">
                        <h3>${materia.nombre}</h3>
                        <p class="materia-clave">${materia.clave}</p>
                        <p class="materia-profesor">Prof. ${materia.profesor}</p>
                    </div>
                    <div class="promedio-circle" style="background: ${promedioColor};">
                        <span class="promedio-number">${materia.promedio_final.toFixed(1)}</span>
                        <span class="promedio-icon">${promedioIcon}</span>
                    </div>
                </div>
                <div class="materia-calificaciones">
                    ${materia.calificaciones.length > 0 ? materia.calificaciones.map(cal => `
                        <div class="calificacion-item">
                            <span class="calificacion-tipo">${formatearTipo(cal.tipo)}</span>
                            <span class="calificacion-valor">${cal.calificacion.toFixed(1)}</span>
                        </div>
                    `).join('') : '<p class="no-calificaciones">No hay calificaciones detalladas aún</p>'}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function getCalificacionColor(calificacion) {
    if (calificacion >= 9) return 'excellent';
    if (calificacion >= 8) return 'good';
    if (calificacion >= 7) return 'average';
    if (calificacion >= 6) return 'pass';
    return 'fail';
}

function getCalificacionIcon(calificacion) {
    if (calificacion >= 9) return '🌟';
    if (calificacion >= 8) return '😊';
    if (calificacion >= 7) return '👍';
    if (calificacion >= 6) return '✅';
    return '❌';
}

function obtenerIconoTipo(tipo) {
    const iconos = {
        'participacion': 'fas fa-comments',
        'tarea': 'fas fa-file-alt',
        'proyecto': 'fas fa-project-diagram',
        'examen': 'fas fa-file-contract',
        'actividad': 'fas fa-tasks'
    };
    return iconos[tipo] || 'fas fa-clipboard';
}

function formatearTipo(tipo) {
    const tipos = {
        'participacion': 'Participación',
        'tarea': 'Tarea',
        'proyecto': 'Proyecto',
        'examen': 'Examen',
        'actividad': 'Actividad'
    };
    return tipos[tipo] || tipo;
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Función para actualizar calificaciones en tiempo real (si se implementa WebSocket)
function actualizarCalificacionesEnTiempoReal() {
    // Esta función puede ser implementada más adelante con WebSocket
    // Por ahora, podemos usar polling cada 30 segundos
    setInterval(async () => {
        await cargarCalificaciones();
    }, 30000);
}

// Iniciar actualización en tiempo real
actualizarCalificacionesEnTiempoReal();

// Función para cargar materias disponibles para darse de baja
async function cargarMateriasParaBaja() {
    try {
        const data = await apiRequest('/calificaciones/alumno/todas');
        const select = document.getElementById('materiaBajaSelect');
        
        if (!data.materias || data.materias.length === 0) {
            select.innerHTML = '<option value="">No hay materias inscritas</option>';
            select.disabled = true;
            return;
        }
        
        select.innerHTML = '<option value="">Selecciona una materia...</option>';
        data.materias.forEach(materia => {
            select.innerHTML += `<option value="${materia.materia_id}">${materia.nombre} - ${materia.clave}</option>`;
        });
    } catch (error) {
        console.error('Error al cargar materias para baja:', error);
        const select = document.getElementById('materiaBajaSelect');
        select.innerHTML = '<option value="">Error al cargar materias</option>';
        select.disabled = true;
    }
}

// Función para darse de baja de una materia
async function darseDeBaja() {
    const materiaId = document.getElementById('materiaBajaSelect').value;
    
    if (!materiaId) {
        mostrarToast('Selecciona una materia para darte de baja', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres darte de baja de esta materia? Esta acción no se puede deshacer y perderás acceso a todas tus calificaciones y actividades.')) {
        return;
    }
    
    try {
        const response = await apiRequest(`/calificaciones/alumno/materia/${materiaId}/baja`, {
            method: 'DELETE'
        });
        
        mostrarToast('Te has dado de baja correctamente', 'success');
        
        // Recargar calificaciones y materias
        await cargarCalificaciones();
        await cargarMateriasParaBaja();
        
        // Limpiar el select
        document.getElementById('materiaBajaSelect').value = '';
        
    } catch (error) {
        mostrarToast(error.message || 'No se pudo procesar la solicitud de baja', 'error');
    }
}

// Exportar funciones al scope global
window.darseDeBaja = darseDeBaja;