// Redondeo personalizado: .5 o menos baja, .6 o más sube
function redondearCalificacionAlumno(cal) {
    const parteEntera = Math.floor(cal);
    return (cal - parteEntera) >= 0.6 ? parteEntera + 1 : parteEntera;
}

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); 
    mostrarInfoUsuario(); 
    mostrarFechaActual();
    await cargarCalificaciones();
});

// Exportar funciones al scope global
window.darseDeBaja = darseDeBaja;

async function cargarCalificaciones() {
    try {
        console.log('🔄 Iniciando carga de calificaciones...');
        console.log('🔐 Verificando token:', localStorage.getItem('token') ? 'Token presente' : 'Token ausente');
        
        mostrarToast('Cargando calificaciones...', 'info');
        
        console.log('📡 Haciendo petición a /calificaciones/alumno/todas...');
        const data = await apiRequest('/calificaciones/alumno/todas');
        
        console.log('📋 Datos recibidos:', data);
        console.log('📊 Materias recibidas:', data.materias?.length || 0);
        
        // Verificar si hay datos de calificaciones (materias o calificaciones individuales)
        const tieneMaterias = data.materias && data.materias.length > 0;
        const tieneCalificaciones = data.materias && data.materias.some(m => 
            (m.calificaciones && m.calificaciones.length > 0) || 
            (m.tareas !== undefined || m.examenes !== undefined || m.participacion !== undefined || 
             m.proyectos !== undefined || m.practicas !== undefined || m.calificacion_final !== undefined)
        );
        
        console.log('🔍 Verificación de datos:', {
            tieneMaterias,
            tieneCalificaciones,
            totalMaterias: data.materias?.length || 0,
            materiasConCalificaciones: data.materias?.filter(m => 
                (m.calificaciones && m.calificaciones.length > 0) || 
                (m.tareas !== undefined || m.examenes !== undefined || m.participacion !== undefined || 
                 m.proyectos !== undefined || m.practicas !== undefined || m.calificacion_final !== undefined)
            ).length || 0
        });
        
        if (!tieneMaterias && !tieneCalificaciones) {
            console.log('⚠️ No hay materias ni calificaciones en la respuesta');
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

        console.log('✅ Materias encontradas, procesando datos...');
        
        // Actualizar resumen general
        actualizarResumenGeneral(data);
        
        // Llenar select de materias para darse de baja
        llenarSelectMaterias(data.materias);
        
        // Mostrar calificaciones por materia
        mostrarCalificacionesPorMateria(data.materias);
        
        console.log('🎉 Calificaciones cargadas exitosamente');
        mostrarToast('Calificaciones cargadas correctamente', 'success');
    } catch (error) {
        console.error('❌ Error al cargar calificaciones:', error);
        console.error('🔍 Detalles del error:', error.message);
        mostrarToast('Error al cargar calificaciones', 'error');
        mostrarResumenVacio();
    }
}

function llenarSelectMaterias(materias) {
    const materiaSelect = document.getElementById('materiaSelect');
    if (!materiaSelect) return;
    
    // Limpiar opciones existentes
    materiaSelect.innerHTML = '<option value="">Selecciona una materia...</option>';
    
    // Agregar materias
    materias.forEach(materia => {
        const option = document.createElement('option');
        option.value = materia.materia_id || materia.id;
        option.textContent = `${materia.nombre} (${materia.clave || 'N/A'})`;
        materiaSelect.appendChild(option);
    });
}

function mostrarResumenVacio() {
    document.getElementById('promedioGeneral').textContent = '0.0';
    document.getElementById('totalMaterias').textContent = '0';
    document.getElementById('materiasAprobadas').textContent = '0';
    
    // Limpiar select de materias
    const materiaSelect = document.getElementById('materiaSelect');
    if (materiaSelect) {
        materiaSelect.innerHTML = '<option value="">Selecciona una materia...</option>';
    }
}

function actualizarResumenGeneral(data) {
    console.log('Actualizando resumen general con datos:', data);
    
    const materias = data.materias || [];
    
    // Usar los datos del backend directamente (ya están calculados)
    const promedioGeneral = parseFloat(data.promedio_general) || 0;
    const totalMaterias = data.total_materias || materias.length || 0;
    
    // Calcular aprobadas/reprobadas basado en las calificaciones reales (misma lógica que dashboard)
    const aprobadas = materias.filter(m => {
        const final = parseFloat(m.promedio_final) || 0;
        return final >= 6 && final > 0; // Solo cuenta si tiene calificación y está aprobada
    }).length;
    const reprobadas = materias.filter(m => {
        const final = parseFloat(m.promedio_final) || 0;
        return final < 6 && final > 0; // Solo cuenta si tiene calificación y está reprobada
    }).length;
    const sinCalificacion = materias.filter(m => {
        const final = parseFloat(m.promedio_final) || 0;
        return final === 0; // Sin calificación registrada
    }).length;
    
    console.log('📊 Estadísticas recalculadas localmente:', {
        promedioGeneral,
        totalMaterias,
        aprobadas,
        reprobadas,
        sinCalificacion,
        materiasConCalificacion: materias.filter(m => (parseFloat(m.promedio_final) || 0) > 0).length
    });
    
    console.log('Estadísticas calculadas:', {
        promedioGeneral,
        totalMaterias,
        aprobadas,
        reprobadas,
        sinCalificacion,
        materiasCount: materias.length
    });
    
    // Actualizar DOM
    document.getElementById('promedioGeneral').textContent = promedioGeneral.toFixed(2);
    document.getElementById('totalMaterias').textContent = totalMaterias;
    document.getElementById('materiasAprobadas').textContent = aprobadas;
    
    // Agregar información adicional si existen los elementos
    const reprobadasElement = document.getElementById('materiasReprobadas');
    const sinCalificacionElement = document.getElementById('materiasSinCalificacion');
    
    if (reprobadasElement) {
        reprobadasElement.textContent = reprobadas;
    }
    if (sinCalificacionElement) {
        sinCalificacionElement.textContent = sinCalificacion;
    }
    
    // Actualizar el círculo de promedio con color dinámico
    const promedioCircle = document.querySelector('.stat-circle');
    if (promedioCircle) {
        promedioCircle.style.background = getPromedioColor(promedioGeneral);
    }
    
    // Agregar mensaje de estado
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        if (sinCalificacion === totalMaterias) {
            statusMessage.textContent = 'Aún no tienes calificaciones registradas';
            statusMessage.className = 'status-message info';
        } else if (promedioGeneral >= 8) {
            statusMessage.textContent = '¡Excelente desempeño académico!';
            statusMessage.className = 'status-message success';
        } else if (promedioGeneral >= 6) {
            statusMessage.textContent = 'Buen desempeño académico';
            statusMessage.className = 'status-message good';
        } else {
            statusMessage.textContent = 'Necesitas mejorar tu desempeño';
            statusMessage.className = 'status-message warning';
        }
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
        const promedioFinal = parseFloat(materia.promedio_final) || parseFloat(materia.calificacion_final) || 0;
        const calRedondeada = materia.calificacion_redondeada != null ? parseFloat(materia.calificacion_redondeada) : redondearCalificacionAlumno(promedioFinal);
        const promedioColor = getCalificacionColor(calRedondeada);
        const promedioIcon = getCalificacionIcon(calRedondeada);
        
        // Verificar si tiene calificaciones (usando !== null para detectar valores 0 también)
        const tieneCalificaciones = (materia.calificaciones && materia.calificaciones.length > 0) ||
            materia.tareas !== null || materia.examenes !== null || 
            materia.participacion !== null || materia.proyectos !== null || 
            materia.practicas !== null;
        
        // Obtener ponderaciones si están disponibles
        const pond = materia.ponderaciones || {};
        
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
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                        <div class="promedio-badge" style="background: ${promedioColor}; color: white; padding: 0.5rem 1rem; border-radius: 2rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.25rem;">${calRedondeada}</span>
                            <span style="font-size: 1rem;">${promedioIcon}</span>
                        </div>
                        <span style="color: #94a3b8; font-size: 0.75rem;">Sin redondeo: ${promedioFinal.toFixed(2)}</span>
                    </div>
                </div>
                
                ${tieneCalificaciones ? `
                    <div class="calificaciones-list">
                        <h4 style="margin: 0 0 1rem 0; color: #374151; font-size: 1rem; font-weight: 600;">Calificaciones Detalladas</h4>
                        
                        ${renderCalificacionItem('📝 Tareas', materia.tareas, pond.tarea)}
                        ${renderCalificacionItem('📋 Exámenes', materia.examenes, pond.examen)}
                        ${renderCalificacionItem('👥 Participación', materia.participacion, pond.participacion)}
                        ${renderCalificacionItem('🚀 Proyectos', materia.proyectos, pond.proyecto)}
                        ${renderCalificacionItem('💻 Prácticas', materia.practicas, pond.practica)}
                    </div>
                ` : `
                    <div class="empty-calificaciones" style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: 0.5rem; border: 1px dashed #cbd5e1;">
                        <i class="fas fa-inbox" style="font-size: 2rem; color: #94a3b8; margin-bottom: 1rem;"></i>
                        <p style="color: #64748b; margin: 0;">No hay calificaciones registradas para esta materia</p>
                        <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">Tu profesor aún no ha registrado calificaciones</p>
                    </div>
                `}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderCalificacionItem(label, valor, ponderacion) {
    if (valor === null || valor === undefined) return '';
    const valorNum = parseFloat(valor) || 0;
    const colorCalificacion = getCalificacionColor(valorNum);
    const pondText = ponderacion ? ` (${ponderacion}%)` : '';
    return `
        <div class="calificacion-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: 0.5rem; margin-bottom: 0.5rem;">
            <div>
                <span style="color: #64748b; font-size: 0.875rem; font-weight: 500;">
                    <i class="fas fa-clipboard-check"></i> ${label}
                </span>
                <span style="color: #94a3b8; font-size: 0.75rem;">${pondText}</span>
            </div>
            <span style="font-weight: 600; color: ${colorCalificacion}; font-size: 1.125rem;">
                ${valorNum.toFixed(1)}
            </span>
        </div>
    `;
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
        'tarea': '📝 Tareas',
        'examen': '📋 Exámenes',
        'participacion': '👥 Participación',
        'proyecto': '🚀 Proyectos',
        'practica': '💻 Prácticas',
        'actividad': '📚 Actividades',
        'general': '📊 General',
        'final': '🎯 Calificación',
        'final_sin_redondeo': '📐 Calificación Final'
    };
    return tipos[tipo] || `📌 ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;
}

async function darseDeBaja() {
    const materiaSelect = document.getElementById('materiaSelect');
    const materia_id = materiaSelect.value;
    
    if (!materia_id) {
        mostrarToast('Por favor selecciona una materia para darte de baja', 'error');
        return;
    }
    
    const materia_nombre = materiaSelect.options[materiaSelect.selectedIndex].text;
    
    if (!confirm(`¿Estás seguro que deseas darte de baja de la materia "${materia_nombre}"? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        mostrarToast('Procesando solicitud de baja...', 'info');
        
        const response = await apiRequest(`/calificaciones/alumno/materia/${materia_id}/baja`, {
            method: 'DELETE'
        });
        
        mostrarToast(response.message || 'Te has dado de baja correctamente', 'success');
        
        // Recargar calificaciones para actualizar la lista
        await cargarCalificaciones();
        
        // Actualizar el select de materias
        materiaSelect.value = '';
        
    } catch (error) {
        console.error('Error al darse de baja:', error);
        mostrarToast(error.message || 'Error al darse de baja', 'error');
    }
}
