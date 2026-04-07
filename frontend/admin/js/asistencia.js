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
    document.getElementById('asistenciasContainer').innerHTML = `
        <table><thead><tr><th>Materia</th><th>Estudiante</th><th>Estado</th></tr></thead><tbody>
        ${asistencias.map(a => `<tr><td>${a.materia_nombre}</td><td>${a.estudiante_nombre}</td><td>${a.estado}</td></tr>`).join('')}
        </tbody></table>
    `;
}