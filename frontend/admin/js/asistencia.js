document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMaterias();
    document.getElementById('fechaAsistencia').valueAsDate = new Date();
    document.getElementById('todasLasFechas').addEventListener('change', toggleFiltroFechas);
    await cargarAsistencias();
});

function toggleFiltroFechas() {
    const verTodas = document.getElementById('todasLasFechas').checked;
    document.getElementById('fechaAsistencia').disabled = verTodas;
}

async function cargarMaterias() {
    try {
        const materias = await apiRequest('/admin/materias');
        const select = document.getElementById('materiaSelect');
        select.innerHTML =
            '<option value="">Todas las materias</option>' +
            materias.map((m) => `<option value="${m.id}">${m.nombre}</option>`).join('');
    } catch (error) {
        console.error('Error cargando materias:', error);
        const select = document.getElementById('materiaSelect');
        select.innerHTML = '<option value="">Error cargando materias</option>';
        mostrarToast('Error al cargar materias. Intenta recargar la página.', 'warning');
    }
}

function selectEstado(asistencia) {
    return `
        <select onchange="actualizarAsistencia(${asistencia.id}, this.value)">
            <option value="presente" ${asistencia.estado === 'presente' ? 'selected' : ''}>Presente</option>
            <option value="ausente" ${asistencia.estado === 'ausente' ? 'selected' : ''}>Ausente</option>
            <option value="retardo" ${asistencia.estado === 'retardo' ? 'selected' : ''}>Retardo</option>
        </select>
    `;
}

async function cargarAsistencias() {
    const materiaId = document.getElementById('materiaSelect').value;
    const materiaNombre = document.getElementById('materiaSelect').options[document.getElementById('materiaSelect').selectedIndex]?.text || 'Todas las materias';
    const fecha = document.getElementById('fechaAsistencia').value;
    const todasLasFechas = document.getElementById('todasLasFechas').checked;
    
    let url = '/admin/asistencias?';
    if (materiaId) url += `materia_id=${materiaId}&`;
    if (fecha && !todasLasFechas) url += `fecha=${fecha}&`;
    
    try {
        const asistencias = await apiRequest(url);
        
        // Ocultar información de filtros para mejor encaje visual
        let filtrosInfo = '';
        
        if (!asistencias.length) {
            document.getElementById('asistenciasContainer').innerHTML =
                '<div class="empty-state">No hay asistencias para los filtros.</div>';
            return;
        }
        
        document.getElementById('asistenciasContainer').innerHTML = filtrosInfo + 
            `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Estudiante</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
                ${asistencias.map(a => `<tr>
                    <td data-label="Materia"><span class="materia-destacada">${a.materia_nombre}</span></td>
                    <td data-label="Estudiante">${a.estudiante_nombre}</td>
                    <td data-label="Fecha">${formatearFecha(a.fecha)}</td>
                    <td data-label="Estado">${selectEstado(a)}</td>
                    <td data-label="Acciones" class="table-actions">
                        <button type="button" class="btn btn-danger btn-sm" onclick="eliminarAsistencia(${a.id})">Eliminar</button>
                    </td>
                </tr>`).join('')}
            </tbody></table></div>`;
    } catch (error) {
        console.error('Error cargando asistencias:', error);
        document.getElementById('asistenciasContainer').innerHTML = 
            '<div class="empty-state">Error al cargar asistencias. El servidor puede estar temporalmente no disponible. Intenta recargar la página.</div>';
        mostrarToast('Error al cargar asistencias. El servidor está temporalmente no disponible.', 'warning');
    }
}

async function actualizarAsistencia(id, estado) {
    try {
        await apiRequest(`/admin/asistencias/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ estado }),
        });
        mostrarToast('Asistencia actualizada', 'success');
    } catch (error) {
        console.error('Error actualizando asistencia:', error);
        mostrarToast('Error al actualizar asistencia. El servidor está temporalmente no disponible.', 'error');
    }
}

async function eliminarAsistencia(id) {
    if (!confirm('Eliminar este registro de asistencia?')) return;
    try {
        await apiRequest(`/admin/asistencias/${id}`, { method: 'DELETE' });
        mostrarToast('Asistencia eliminada', 'success');
        cargarAsistencias();
    } catch (error) {
        console.error('Error eliminando asistencia:', error);
        mostrarToast('Error al eliminar asistencia. El servidor está temporalmente no disponible.', 'error');
    }
}
async function generarReportesAsistencia() {
    const materiaId = document.getElementById('materiaSelect')?.value;
    const todasLasMaterias = !materiaId;
    
    try {
        let datos;
        if (todasLasMaterias) {
            // Reporte general de todas las materias
            try {
                datos = await apiRequest('/admin/asistencias/reportes/general');
            } catch (error) {
                console.error('Error en reporte general:', error);
                // Datos de fallback si el servidor falla
                datos = {
                    total_clases: 0,
                    total_presentes: 0,
                    total_ausentes: 0,
                    total_retardos: 0,
                    por_materia: []
                };
                mostrarToast('El servidor no está disponible. Mostrando datos limitados.', 'warning');
            }
        } else {
            // Reporte específico de una materia
            try {
                datos = await apiRequest(`/asistencia/estadisticas/${materiaId}`);
            } catch (error) {
                console.error('Error en estadísticas de materia:', error);
                // Datos de fallback si el servidor falla
                datos = {
                    totales: {
                        total_presentes: 0,
                        total_ausentes: 0,
                        total_retardos: 0,
                        total_clases: 0
                    },
                    por_fecha: []
                };
                mostrarToast('El servidor no está disponible. Mostrando datos limitados.', 'warning');
            }
        }
        
        mostrarReportesAsistencia(datos, todasLasMaterias);
    } catch (error) {
        console.error('Error general en generarReportesAsistencia:', error);
        const container = document.getElementById('reportesContainer');
        if (container) {
            container.innerHTML = '<div class="panel-card"><h3>📊 Reportes de Asistencia</h3><p>Error al generar reportes. El servidor está temporalmente no disponible.</p></div>';
        }
        mostrarToast('Error al generar reportes. El servidor está temporalmente no disponible.', 'error');
    }
}

function mostrarReportesAsistencia(datos, esGeneral) {
    const container = document.getElementById('reportesContainer');
    if (!container) return;
    
    let html = '<div class="panel-card"><h3>📊 Reportes de Asistencia</h3>';
    
    if (esGeneral) {
        // Reporte general
        html += `
            <div class="stats-grid">
                <div class="stat-item total">
                    <span class="stat-number">${datos.total_clases || 0}</span>
                    <span class="stat-label">Total Clases</span>
                </div>
                <div class="stat-item presente">
                    <span class="stat-number">${datos.total_presentes || 0}</span>
                    <span class="stat-label">Total Presentes</span>
                </div>
                <div class="stat-item ausente">
                    <span class="stat-number">${datos.total_ausentes || 0}</span>
                    <span class="stat-label">Total Ausentes</span>
                </div>
                <div class="stat-item retardo">
                    <span class="stat-number">${datos.total_retardos || 0}</span>
                    <span class="stat-label">Total Retardos</span>
                </div>
            </div>
        `;
        
        if (datos.por_materia && datos.por_materia.length > 0) {
            html += '<h4>Por Materia:</h4><div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Presentes</th><th>Ausentes</th><th>Retardos</th><th>Total</th><th>% Asistencia</th></tr></thead><tbody>';
            datos.por_materia.forEach(materia => {
                const porcentaje = materia.total > 0 ? ((materia.presentes / materia.total) * 100).toFixed(1) : 0;
                html += `
                    <tr>
                        <td data-label="Materia">${materia.materia_nombre}</td>
                        <td data-label="Presentes">${materia.presentes}</td>
                        <td data-label="Ausentes">${materia.ausentes}</td>
                        <td data-label="Retardos">${materia.retardos}</td>
                        <td data-label="Total">${materia.total}</td>
                        <td data-label="% Asistencia">${porcentaje}%</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        }
    } else {
        // Reporte específico de materia
        const porcentajePresentes = datos.totales?.total > 0 ? ((datos.totales.total_presentes / datos.totales.total) * 100).toFixed(1) : 0;
        
        html += `
            <div class="stats-grid">
                <div class="stat-item presente">
                    <span class="stat-number">${datos.totales?.total_presentes || 0}</span>
                    <span class="stat-label">Presentes (${porcentajePresentes}%)</span>
                </div>
                <div class="stat-item ausente">
                    <span class="stat-number">${datos.totales?.total_ausentes || 0}</span>
                    <span class="stat-label">Ausentes</span>
                </div>
                <div class="stat-item retardo">
                    <span class="stat-number">${datos.totales?.total_retardos || 0}</span>
                    <span class="stat-label">Retardos</span>
                </div>
                <div class="stat-item total">
                    <span class="stat-number">${datos.totales?.total_clases || 0}</span>
                    <span class="stat-label">Total Clases</span>
                </div>
            </div>
        `;
        
        if (datos.por_fecha && datos.por_fecha.length > 0) {
            html += '<h4>Historial por Fecha:</h4><div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Presentes</th><th>Ausentes</th><th>Retardos</th><th>Total</th><th>% Asistencia</th></tr></thead><tbody>';
            datos.por_fecha.forEach(dia => {
                const porcentaje = dia.total > 0 ? ((dia.presentes / dia.total) * 100).toFixed(1) : 0;
                html += `
                    <tr>
                        <td data-label="Fecha">${formatearFecha(dia.fecha)}</td>
                        <td data-label="Presentes">${dia.presentes}</td>
                        <td data-label="Ausentes">${dia.ausentes}</td>
                        <td data-label="Retardos">${dia.retardos}</td>
                        <td data-label="Total">${dia.total}</td>
                        <td data-label="% Asistencia">${porcentaje}%</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

window.cargarAsistencias = cargarAsistencias;
window.actualizarAsistencia = actualizarAsistencia;
window.eliminarAsistencia = eliminarAsistencia;
window.generarReportesAsistencia = generarReportesAsistencia;


