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
    let url = '/admin/calificaciones';
    if (materiaId) url += `?materia_id=${materiaId}`;
    const calificaciones = await apiRequest(url);
    if (!calificaciones.length) {
        document.getElementById('calificacionesContainer').innerHTML = '<div class="empty-state">No hay calificaciones registradas.</div>';
        return;
    }
    const html = calificaciones.map(c => `
        <div class="calificacion-item">
            <div class="calificacion-info">
                <div class="calificacion-materia">${c.materia_nombre}</div>
                <div class="calificacion-estudiante">${c.estudiante_nombre}</div>
                <div class="calificacion-actividad">${c.actividad_titulo || c.tipo}</div>
                <div class="calificacion-valor">${c.calificacion}</div>
                <div class="calificacion-fecha">${formatearFecha(c.fecha_registro)}</div>
                <div class="calificacion-acciones">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="editarCalificacion(${c.id}, ${c.calificacion})">Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarCalificacion(${c.id})">Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
    document.getElementById('calificacionesContainer').innerHTML = html;
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
    const html = archivos.map(a => `
        <div class="calificacion-archivo-item">
            <div class="calificacion-archivo-info">
                <div class="calificacion-archivo-nombre">${a.nombre_archivo}</div>
                <div class="calificacion-archivo-profesor">${a.profesor_nombre}</div>
                <div class="calificacion-archivo-materia">${a.materia_nombre}</div>
                <div class="calificacion-archivo-tipo">${a.tipo}</div>
                <div class="calificacion-archivo-estado">${a.estado || 'Procesado'}</div>
                <div class="calificacion-archivo-acciones">
                    <button type="button" class="btn btn-secondary btn-sm" data-auth-download="/admin/calificaciones/archivos/${a.id}/descarga">Descargar archivo</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarArchivoCalificacionAdmin(${a.id})">Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
    container.innerHTML = html;
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