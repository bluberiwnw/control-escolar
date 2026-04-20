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
    const html = asistencias.map(a => `
        <div class="asistencia-item">
            <div class="asistencia-info">
                <div class="asistencia-materia">${a.materia_nombre}</div>
                <div class="asistencia-estudiante">${a.estudiante_nombre}</div>
                <div class="asistencia-fecha">${formatearFecha(a.fecha)}</div>
                <div class="asistencia-estado-select">${selectEstado(a)}</div>
                <div class="asistencia-acciones">
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarAsistencia(${a.id})">Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
    document.getElementById('asistenciasContainer').innerHTML = html;
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


