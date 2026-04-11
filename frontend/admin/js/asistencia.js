document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarMaterias();
    document.getElementById('fechaAsistencia').valueAsDate = new Date();
});

async function cargarMaterias() {
    const materias = await apiRequest('/admin/materias');
    const select = document.getElementById('materiaSelect');
    select.innerHTML = '<option value="">Todas las materias</option>' + materias.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

async function cargarAsistencias() {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    let url = `/admin/asistencias?fecha=${fecha}`;
    if (materiaId) url += `&materia_id=${materiaId}`;
    const asistencias = await apiRequest(url);
    
    // Generar tabla con columna de acciones
    let html = `
        <table class="tabla-moderna">
            <thead>
                <tr>
                    <th>Materia</th>
                    <th>Estudiante</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    asistencias.forEach(a => {
        html += `
            <tr data-id="${a.id}">
                <td>${a.materia_nombre}</td>
                <td>${a.estudiante_nombre}</td>
                <td>${a.estado}</td>
                <td>
                    <button class="btn-small btn-danger" onclick="eliminarAsistencia(${a.id})">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    document.getElementById('asistenciasContainer').innerHTML = html;
}

async function eliminarAsistencia(id) {
    if (!confirm('¿Eliminar este registro de asistencia permanentemente?')) return;
    try {
        await apiRequest(`/admin/asistencias/${id}`, { method: 'DELETE' });
        mostrarToast('Asistencia eliminada correctamente', 'success');
        cargarAsistencias(); // recargar la tabla
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}