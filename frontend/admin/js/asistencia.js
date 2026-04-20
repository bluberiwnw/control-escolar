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
    const materias = await apiRequest('/admin/materias');
    const select = document.getElementById('materiaSelect');
    select.innerHTML =
        '<option value="">Todas las materias</option>' +
        materias.map((m) => `<option value="${m.id}">${m.nombre}</option>`).join('');
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
    const fecha = document.getElementById('fechaAsistencia').value;
    const todasLasFechas = document.getElementById('todasLasFechas').checked;
    let url = '/admin/asistencias';
    const q = [];
    if (todasLasFechas) q.push('todas=true');
    else if (fecha) q.push(`fecha=${fecha}`);
    if (materiaId) q.push(`materia_id=${materiaId}`);
    if (q.length) url += `?${q.join('&')}`;
    const asistencias = await apiRequest(url);
    if (!asistencias.length) {
        document.getElementById('asistenciasContainer').innerHTML =
            '<div class="empty-state">No hay asistencias para los filtros.</div>';
        return;
    }
    document.getElementById('asistenciasContainer').innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Estudiante</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        ${asistencias.map(a => `<tr><td data-label="Materia">${a.materia_nombre}</td><td data-label="Estudiante">${a.estudiante_nombre}</td><td data-label="Fecha">${formatearFecha(a.fecha)}</td><td data-label="Estado">${selectEstado(a)}</td><td data-label="Acciones" class="table-actions"><button type="button" class="btn btn-danger btn-sm" onclick="eliminarAsistencia(${a.id})">Eliminar</button></td></tr>`).join('')}
        </tbody></table></div>`;
}

async function actualizarAsistencia(id, estado) {
    await apiRequest(`/admin/asistencias/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ estado }),
    });
    mostrarToast('Asistencia actualizada', 'success');
}

async function eliminarAsistencia(id) {
    if (!confirm('Eliminar este registro de asistencia?')) return;
    await apiRequest(`/admin/asistencias/${id}`, { method: 'DELETE' });
    mostrarToast('Asistencia eliminada', 'success');
    cargarAsistencias();
}
window.cargarAsistencias = cargarAsistencias;
window.actualizarAsistencia = actualizarAsistencia;
window.eliminarAsistencia = eliminarAsistencia;


