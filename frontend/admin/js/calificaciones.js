document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarMaterias();
    await cargarCalificaciones();
    await cargarArchivosCalificaciones();
});

async function cargarMaterias() {
    const materias = await apiRequest('/admin/materias');
    const select = document.getElementById('materiaSelect');
    select.innerHTML = '<option value="">Todas las materias</option>' + materias.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

async function cargarCalificaciones() {
    const materiaId = document.getElementById('materiaSelect').value;
    const materiaNombre = document.getElementById('materiaSelect').options[document.getElementById('materiaSelect').selectedIndex]?.text || 'Todas las materias';
    let url = '/admin/calificaciones';
    if (materiaId) url += `?materia_id=${materiaId}`;
    const calificaciones = await apiRequest(url);
    
    // Agregar información de filtros aplicados
    let filtrosInfo = '';
    if (materiaId) {
        filtrosInfo = `
            <div class="filtros-aplicados">
                <h3>
                    <i class="fas fa-filter"></i> Filtro Aplicado
                </h3>
                <div class="filtros-badges">
                    <span class="badge">Materia: ${materiaNombre}</span>
                </div>
            </div>
        `;
    }
    
    if (!calificaciones.length) {
        document.getElementById('calificacionesContainer').innerHTML = filtrosInfo + '<div class="empty-state">No hay calificaciones registradas para esta materia.</div>';
        return;
    }
    const container = document.getElementById('calificacionesContainer');
    container.innerHTML = filtrosInfo + 
        `<div class="calificaciones-grid">
            ${calificaciones.map(c => `
                <div class="calificacion-card">
                    <div class="calificacion-header">
                        <div class="calificacion-materia">
                            <span class="materia-badge">${c.materia_nombre}</span>
                        </div>
                        <div class="calificacion-valor">
                            <span class="calificacion-score">${c.calificacion}</span>
                            <span class="calificacion-label">Calificación</span>
                        </div>
                    </div>
                    <div class="calificacion-body">
                        <div class="calificacion-info">
                            <div class="calificacion-estudiante">
                                <i class="fas fa-user"></i> ${c.estudiante_nombre}
                            </div>
                            <div class="calificacion-actividad">
                                <i class="fas fa-tasks"></i> ${c.actividad_titulo || c.tipo}
                            </div>
                            <div class="calificacion-fecha">
                                <i class="fas fa-calendar"></i> ${formatearFecha(c.fecha_registro)}
                            </div>
                        </div>
                    </div>
                    <div class="calificacion-actions">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="editarCalificacion(${c.id}, ${c.calificacion})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="eliminarCalificacion(${c.id})">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>`;
}

async function editarCalificacion(id, actual) {
    const valor = window.prompt('Nueva calificación (5 - 10):', actual);
    if (valor === null) return;
    const numero = parseFloat(valor);
    if (Number.isNaN(numero) || numero < 5 || numero > 10) {
        mostrarToast('La calificación debe estar entre 5 y 10', 'error');
        return;
    }
    await apiRequest(`/admin/calificaciones/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ calificacion: numero }),
    });
    mostrarToast('Calificación actualizada', 'success');
    await cargarCalificaciones();
}

async function eliminarCalificacion(id) {
    if (!window.confirm('¿Eliminar esta calificación?')) return;
    await apiRequest(`/admin/calificaciones/${id}`, { method: 'DELETE' });
    mostrarToast('Calificación eliminada', 'success');
    await cargarCalificaciones();
}

async function cargarArchivosCalificaciones() {
    const archivos = await apiRequest('/admin/calificaciones/archivos');
    const container = document.getElementById('archivosCalificacionesContainer');
    if (!archivos.length) {
        container.innerHTML = '<div class="empty-state">No hay archivos registrados.</div>';
        return;
    }
    container.innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Archivo</th><th>Profesor</th><th>Materia</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        ${archivos
            .map(
                (a) => `<tr><td data-label="Archivo">${a.nombre_archivo}</td><td data-label="Profesor">${a.profesor_nombre}</td><td data-label="Materia">${a.materia_nombre}</td><td data-label="Tipo">${a.tipo}</td><td data-label="Estado">${a.estado || 'Procesado'}</td><td data-label="Acciones" class="table-actions"><button type="button" class="btn btn-secondary btn-sm" data-auth-download="/admin/calificaciones/archivos/${a.id}/descarga">Descargar archivo</button><button type="button" class="btn btn-danger btn-sm" onclick="eliminarArchivoCalificacionAdmin(${a.id})">Eliminar</button></td></tr>`
            )
            .join('')}
        </tbody></table></div>`;
}

async function eliminarArchivoCalificacionAdmin(id) {
    if (!window.confirm('Eliminar archivo de calificaciones?')) return;
    await apiRequest(`/admin/calificaciones/archivos/${id}`, { method: 'DELETE' });
    mostrarToast('Archivo eliminado', 'success');
    await cargarArchivosCalificaciones();
}

window.editarCalificacion = editarCalificacion;
window.eliminarCalificacion = eliminarCalificacion;
window.eliminarArchivoCalificacionAdmin = eliminarArchivoCalificacionAdmin;