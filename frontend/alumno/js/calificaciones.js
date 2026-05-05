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
    console.log('Actualizando resumen general con datos:', data);
    
    // Calcular estadísticas reales basadas en las calificaciones recibidas
    const materias = data.materias || [];
    
    // Calcular promedio final real basado en todas las calificaciones
    let todasLasCalificaciones = [];
    materias.forEach(materia => {
        if (materia.calificaciones && materia.calificaciones.length > 0) {
            materia.calificaciones.forEach(cal => {
                const valor = parseFloat(cal.calificacion) || 0;
                if (valor > 0) {
                    todasLasCalificaciones.push(valor);
                }
            });
        }
    });
    
    // Promedio general basado en todas las calificaciones individuales
    const promedioGeneralReal = todasLasCalificaciones.length > 0 
        ? todasLasCalificaciones.reduce((sum, cal) => sum + cal, 0) / todasLasCalificaciones.length 
        : 0;
    
    // También calcular promedio por materias (promedio_final)
    const promedioPorMaterias = materias.length > 0 
        ? materias.reduce((sum, m) => sum + (parseFloat(m.promedio_final) || 0), 0) / materias.length 
        : 0;
    
    // Usar el promedio más representativo
    const promedioFinal = todasLasCalificaciones.length > 0 ? promedioGeneralReal : promedioPorMaterias;
    
    const totalMaterias = data.total_materias || materias.length || 0;
    const aprobadas = materias.filter(m => (parseFloat(m.promedio_final) || 0) >= 6).length;
    
    // Calificar el rendimiento del alumno
    let nivelRendimiento = 'Sin calificaciones';
    if (promedioFinal >= 9) nivelRendimiento = 'Excelente';
    else if (promedioFinal >= 8) nivelRendimiento = 'Muy bueno';
    else if (promedioFinal >= 7) nivelRendimiento = 'Bueno';
    else if (promedioFinal >= 6) nivelRendimiento = 'Suficiente';
    else if (promedioFinal > 0) nivelRendimiento = 'Necesita mejorar';
    
    console.log('Estadísticas calculadas:', {
        promedioFinal,
        promedioGeneralReal,
        promedioPorMaterias,
        totalCalificaciones: todasLasCalificaciones.length,
        totalMaterias,
        aprobadas,
        nivelRendimiento
    });
    
    // Actualizar DOM con animación
    const promedioElement = document.getElementById('promedioGeneral');
    const totalElement = document.getElementById('totalMaterias');
    const aprobadasElement = document.getElementById('materiasAprobadas');
    
    // Animar cambio de números
    if (promedioElement) {
        const currentValue = parseFloat(promedioElement.textContent) || 0;
        animateValue(promedioElement, currentValue, promedioFinal, 500, 1);
    }
    
    if (totalElement) {
        totalElement.textContent = totalMaterias;
    }
    
    if (aprobadasElement) {
        aprobadasElement.textContent = aprobadas;
    }
    
    // Actualizar el círculo de promedio con color dinámico
    const promedioCircle = document.querySelector('.stat-circle');
    if (promedioCircle) {
        promedioCircle.style.background = getPromedioColor(promedioFinal);
    }
    
    // Actualizar tarjetas de estadísticas con información adicional
    actualizarTarjetasEstadisticas(promedioFinal, totalMaterias, aprobadas, nivelRendimiento, todasLasCalificaciones.length);
    
    // Actualizar título de estadísticas si existe
    const statsTitle = document.querySelector('.stats-title');
    if (statsTitle) {
        statsTitle.textContent = `Tu Rendimiento Académico (${totalMaterias} ${totalMaterias === 1 ? 'materia' : 'materias'})`;
    }
}

function animateValue(element, start, end, duration, decimals) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = current.toFixed(decimals);
    }, 16);
}

function actualizarTarjetasEstadisticas(promedio, totalMaterias, aprobadas, nivel, totalCalificaciones) {
    // Actualizar tarjeta de promedio con información adicional
    const promedioCard = document.querySelector('.stat-card-profesor:first-child');
    if (promedioCard) {
        const statInfo = promedioCard.querySelector('.stat-info');
        if (statInfo) {
            // Agregar nivel de rendimiento
            let nivelHtml = statInfo.innerHTML;
            if (!nivelHtml.includes('rendimiento-nivel')) {
                nivelHtml += `<div class="rendimiento-nivel" style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">${nivel}</div>`;
                statInfo.innerHTML = nivelHtml;
            }
        }
    }
    
    // Actualizar tarjeta de materias aprobadas con porcentaje
    const aprobadasCard = document.querySelector('.stat-card-profesor:last-child');
    if (aprobadasCard && totalMaterias > 0) {
        const statInfo = aprobadasCard.querySelector('.stat-info');
        if (statInfo) {
            const porcentaje = Math.round((aprobadas / totalMaterias) * 100);
            let aprobadasHtml = statInfo.innerHTML;
            if (!aprobadasHtml.includes('porcentaje-aprobadas')) {
                aprobadasHtml += `<div class="porcentaje-aprobadas" style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">${porcentaje}% de aprobación</div>`;
                statInfo.innerHTML = aprobadasHtml;
            }
        }
    }
    
    // Actualizar tarjeta total con información de calificaciones
    const totalCard = document.querySelector('.stat-card-profesor:nth-child(2)');
    if (totalCard && totalCalificaciones > 0) {
        const statInfo = totalCard.querySelector('.stat-info');
        if (statInfo) {
            let totalHtml = statInfo.innerHTML;
            if (!totalHtml.includes('total-calificaciones')) {
                totalHtml += `<div class="total-calificaciones" style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">${totalCalificaciones} calificación(es)</div>`;
                statInfo.innerHTML = totalHtml;
            }
        }
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
    
    if (!materias || materias.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 3rem;">
                <i class="fas fa-graduation-cap" style="font-size: 3rem; color: #94a3b8; margin-bottom: 1rem;"></i>
                <h3 style="color: #64748b; margin-bottom: 0.5rem;">No hay calificaciones registradas</h3>
                <p style="color: #94a3b8;">Tus calificaciones aparecerán aquí cuando tus profesores las registren.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    materias.forEach(materia => {
        const promedioFinal = parseFloat(materia.promedio_final) || 0;
        const promedioColor = getCalificacionColor(promedioFinal);
        const promedioIcon = getCalificacionIcon(promedioFinal);
        
        // Calcular estadísticas de la materia
        const totalCalifs = materia.calificaciones.length;
        const promedioSimple = totalCalifs > 0 
            ? materia.calificaciones.reduce((sum, cal) => sum + (parseFloat(cal.calificacion) || 0), 0) / totalCalifs 
            : 0;
        
        html += `
            <div class="panel-card" style="margin-bottom: 1.5rem;">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h3 style="margin: 0; color: #1e293b; font-size: 1.25rem; font-weight: 600;">${materia.nombre}</h3>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            <span style="color: #64748b; font-size: 0.875rem;">
                                <i class="fas fa-tag"></i> ${materia.clave || 'N/A'}
                            </span>
                            <span style="color: #64748b; font-size: 0.875rem;">
                                <i class="fas fa-user-tie"></i> Prof. ${materia.profesor || 'N/A'}
                            </span>
                            <span style="color: #64748b; font-size: 0.875rem;">
                                <i class="fas fa-chart-bar"></i> ${totalCalifs} calificación(es)
                            </span>
                        </div>
                    </div>
                    <div class="promedio-badge" style="background: ${promedioColor}; color: white; padding: 0.75rem 1.25rem; border-radius: 2rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; min-width: 80px; justify-content: center;">
                        <span style="font-size: 1.25rem;">${promedioFinal.toFixed(1)}</span>
                        <span style="font-size: 1rem;">${promedioIcon}</span>
                    </div>
                </div>
                
                ${materia.calificaciones.length > 0 ? `
                    <div class="calificaciones-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        ${materia.calificaciones.map(cal => {
                            const calValor = parseFloat(cal.calificacion) || 0;
                            const calColor = getCalificacionColor(calValor);
                            return `
                                <div class="calificacion-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${calColor}; padding: 1rem; border-radius: 0.5rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                        <span style="color: #64748b; font-size: 0.875rem; font-weight: 500;">
                                            <i class="fas fa-clipboard-check"></i> ${formatearTipo(cal.tipo)}
                                        </span>
                                        <span style="background: ${calColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">
                                            ${calValor.toFixed(1)}
                                        </span>
                                    </div>
                                    ${cal.porcentaje_final ? `
                                        <div style="margin-top: 0.5rem;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                                <span style="color: #94a3b8; font-size: 0.75rem;">Progreso</span>
                                                <span style="color: #64748b; font-size: 0.75rem; font-weight: 500;">${cal.porcentaje_final}%</span>
                                            </div>
                                            <div style="background: #e2e8f0; height: 4px; border-radius: 2px; overflow: hidden;">
                                                <div style="background: ${calColor}; height: 100%; width: ${cal.porcentaje_final}%; transition: width 0.3s ease;"></div>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #64748b; font-size: 0.875rem;">
                                <i class="fas fa-calculator"></i> Promedio simple de calificaciones
                            </span>
                            <span style="color: #1e293b; font-weight: 600; font-size: 1.125rem;">
                                ${promedioSimple.toFixed(1)}
                            </span>
                        </div>
                    </div>
                ` : `
                    <div class="empty-calificaciones" style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: 0.5rem; border: 1px dashed #cbd5e1;">
                        <i class="fas fa-inbox" style="font-size: 2rem; color: #94a3b8; margin-bottom: 1rem;"></i>
                        <p style="color: #64748b; margin: 0;">No hay calificaciones detalladas registradas para esta materia</p>
                        <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">Tu profesor aún no ha registrado calificaciones específicas</p>
                    </div>
                `}
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