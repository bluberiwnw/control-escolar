document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); 
    mostrarInfoUsuario(); 
    mostrarFechaActual();
    await cargarCalificaciones();
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
    document.getElementById('promedioGeneral').textContent = data.promedio_general.toFixed(1);
    document.getElementById('totalMaterias').textContent = data.total_materias;
    
    const aprobadas = data.materias.filter(m => m.promedio_final >= 6).length;
    document.getElementById('materiasAprobadas').textContent = aprobadas;
}

function mostrarCalificacionesPorMateria(materias) {
    let html = '<div class="materias-calificaciones">';
    
    materias.forEach(materia => {
        const promedioColor = obtenerColorCalificacion(materia.promedio_final);
        const promedioIcono = obtenerIconoCalificacion(materia.promedio_final);
        
        html += `
            <div class="materia-calificacion-card">
                <div class="materia-header">
                    <div class="materia-info">
                        <h3>${materia.nombre}</h3>
                        <p class="materia-clave">${materia.clave}</p>
                        <p class="materia-profesor"><i class="fas fa-chalkboard-teacher"></i> ${materia.profesor}</p>
                    </div>
                    <div class="materia-promedio">
                        <div class="promedio-circle ${promedioColor}">
                            <span class="promedio-number">${materia.promedio_final.toFixed(1)}</span>
                            <span class="promedio-icon">${promedioIcono}</span>
                        </div>
                        <span class="promedio-label">Promedio</span>
                    </div>
                </div>
                
                <div class="calificaciones-detalle">
                    <h4>Desglose de Calificaciones</h4>
                    <div class="calificaciones-grid">
        `;
        
        // Mostrar calificaciones individuales
        if (materia.calificaciones && materia.calificaciones.length > 0) {
            materia.calificaciones.forEach(calificacion => {
                const calificacionColor = obtenerColorCalificacion(calificacion.calificacion);
                const tipoIcono = obtenerIconoTipo(calificacion.tipo);
                
                html += `
                    <div class="calificacion-item">
                        <div class="calificacion-tipo">
                            <i class="${tipoIcono}"></i>
                            <span>${formatearTipo(calificacion.tipo)}</span>
                        </div>
                        <div class="calificacion-valor">
                            <span class="badge badge-${calificacionColor}">${calificacion.calificacion}</span>
                            ${calificacion.porcentaje_final ? `<small>${calificacion.porcentaje_final}%</small>` : ''}
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="calificacion-vacia">
                    <i class="fas fa-info-circle"></i>
                    <span>No hay calificaciones detalladas registradas</span>
                </div>
            `;
        }
        
        html += `
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    document.getElementById('calificacionesContainer').innerHTML = html;
}

function obtenerColorCalificacion(calificacion) {
    if (calificacion >= 9) return 'excellent';
    if (calificacion >= 8) return 'good';
    if (calificacion >= 7) return 'average';
    if (calificacion >= 6) return 'pass';
    return 'fail';
}

function obtenerIconoCalificacion(calificacion) {
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