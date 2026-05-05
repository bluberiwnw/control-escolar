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
        
        mostrarToast('Calificaciones cargadas correctamente', 'success');
    } catch (error) {
        console.error('Error al cargar calificaciones:', error);
        mostrarToast('Error al cargar calificaciones', 'error');
        mostrarResumenVacio();
    }
}

function mostrarResumenVacio() {
    document.getElementById('promedioGeneral').textContent = '0.0';
    document.getElementById('totalMaterias').textContent = '0';
    document.getElementById('materiasAprobadas').textContent = '0';
}

function actualizarResumenGeneral(data) {
    console.log('Actualizando resumen general con datos:', data);
    
    const materias = data.materias || [];
    
    // Calcular promedio general como promedio simple de los promedios finales
    let totalPromedios = 0;
    let cantidadMaterias = 0;
    
    materias.forEach(materia => {
        const promedio = parseFloat(materia.promedio_final) || 0;
        if (promedio > 0) {
            totalPromedios += promedio;
            cantidadMaterias++;
        }
    });
    
    const promedioGeneral = cantidadMaterias > 0 ? totalPromedios / cantidadMaterias : 0;
    const totalMaterias = data.total_materias || materias.length || 0;
    const aprobadas = materias.filter(m => (parseFloat(m.promedio_final) || 0) >= 6).length;
    
    console.log('Estadísticas calculadas:', {
        promedioGeneral,
        totalMaterias,
        aprobadas,
        materiasCount: materias.length,
        totalPromedios,
        cantidadMaterias
    });
    
    // Actualizar DOM
    document.getElementById('promedioGeneral').textContent = promedioGeneral.toFixed(1);
    document.getElementById('totalMaterias').textContent = totalMaterias;
    document.getElementById('materiasAprobadas').textContent = aprobadas;
    
    // Actualizar el círculo de promedio con color dinámico
    const promedioCircle = document.querySelector('.stat-circle');
    if (promedioCircle) {
        promedioCircle.style.background = getPromedioColor(promedioGeneral);
    }
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
                        </div>
                    </div>
                    <div class="promedio-badge" style="background: ${promedioColor}; color: white; padding: 0.75rem 1.25rem; border-radius: 2rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.25rem;">${promedioFinal.toFixed(1)}</span>
                        <span style="font-size: 1rem;">${promedioIcon}</span>
                    </div>
                </div>
                
                ${materia.calificaciones && materia.calificaciones.length > 0 ? `
                    <div class="calificaciones-list">
                        ${materia.calificaciones.map(cal => `
                            <div class="calificacion-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <div>
                                    <span style="color: #64748b; font-size: 0.875rem; font-weight: 500;">
                                        <i class="fas fa-clipboard-check"></i> ${formatearTipo(cal.tipo)}
                                    </span>
                                    ${cal.fecha_registro ? `
                                        <span style="color: #94a3b8; font-size: 0.75rem; margin-left: 0.5rem;">
                                            (${new Date(cal.fecha_registro).toLocaleDateString()})
                                        </span>
                                    ` : ''}
                                </div>
                                <span style="font-weight: 600; color: #1e293b; font-size: 1.125rem;">
                                    ${(parseFloat(cal.calificacion) || 0).toFixed(1)}
                                </span>
                            </div>
                        `).join('')}
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

function getPromedioColor(promedio) {
    if (promedio >= 9) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    if (promedio >= 8) return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    if (promedio >= 7) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    if (promedio >= 6) return 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
}

function getCalificacionColor(calificacion) {
    if (calificacion >= 9) return '#22c55e';
    if (calificacion >= 8) return '#3b82f6';
    if (calificacion >= 7) return '#f59e0b';
    if (calificacion >= 6) return '#f97316';
    return '#ef4444';
}

function getCalificacionIcon(calificacion) {
    if (calificacion >= 9) return '🌟';
    if (calificacion >= 8) return '✅';
    if (calificacion >= 7) return '👍';
    if (calificacion >= 6) return '📝';
    return '⚠️';
}

function formatearTipo(tipo) {
    const tipos = {
        'tarea': 'Tareas',
        'examen': 'Exámenes',
        'participacion': 'Participación',
        'proyecto': 'Proyectos',
        'actividad': 'Actividades',
        'general': 'General',
        'final': 'Final'
    };
    return tipos[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
}
