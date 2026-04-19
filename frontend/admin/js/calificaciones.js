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
    document.getElementById('calificacionesContainer').innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Estudiante</th><th>Actividad</th><th>Calificación</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>
        ${calificaciones.map(c => `<tr><td data-label="Materia">${c.materia_nombre}</td><td data-label="Estudiante">${c.estudiante_nombre}</td><td data-label="Actividad">${c.actividad_titulo || c.tipo}</td><td data-label="Calificación">${c.calificacion}</td><td data-label="Fecha">${formatearFecha(c.fecha_registro)}</td><td data-label="Acciones" class="table-actions"><button type="button" class="btn btn-secondary btn-sm" onclick="editarCalificacion(${c.id}, ${c.calificacion})">Editar</button><button type="button" class="btn btn-danger btn-sm" onclick="eliminarCalificacion(${c.id})">Eliminar</button></td></tr>`).join('')}
        </tbody></table></div>`;
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
                (a) => `<tr><td data-label="Archivo">${a.nombre_archivo}</td><td data-label="Profesor">${a.profesor_nombre}</td><td data-label="Materia">${a.materia_nombre}</td><td data-label="Tipo">${a.tipo}</td><td data-label="Estado">${a.estado || 'Procesado'}</td><td data-label="Acciones" class="table-actions"><button type="button" class="btn btn-secondary btn-sm" onclick="descargarConAuth('/admin/calificaciones/archivos/${a.id}/descarga', ${JSON.stringify(a.nombre_archivo)})">Descargar archivo</button><button type="button" class="btn btn-danger btn-sm" onclick="eliminarArchivoCalificacionAdmin(${a.id})">Eliminar</button></td></tr>`
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