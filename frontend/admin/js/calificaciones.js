document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarMaterias();
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
    document.getElementById('calificacionesContainer').innerHTML = `
        <table><thead><tr><th>Materia</th><th>Estudiante</th><th>Calificación</th><th>Fecha</th></tr></thead><tbody>
        ${calificaciones.map(c => `<tr><td>${c.materia_nombre}</td><td>${c.estudiante_nombre}</td><td>${c.calificacion}</td><td>${formatearFecha(c.fecha_registro)}</td></tr>`).join('')}
        </tbody></table>
    `;
}