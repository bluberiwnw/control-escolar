document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const calificaciones = await apiRequest('/alumno/calificaciones');
    if (!calificaciones.length) {
        document.getElementById('calificacionesContainer').innerHTML = '<div class="empty-state">No hay calificaciones registradas.</div>';
        return;
    }
    let html = '<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Actividad</th><th>Calificación</th><th>Fecha</th></tr></thead><tbody>';
    calificaciones.forEach((c) => {
        html += `<tr><td data-label="Materia">${c.materia_nombre}</td><td data-label="Actividad">${c.actividad_titulo || c.tipo}</td><td data-label="Calificación">${c.calificacion}</td><td data-label="Fecha">${formatearFecha(c.fecha_registro)}</td></tr>`;
    });
    html += '</tbody></table></div>';
    document.getElementById('calificacionesContainer').innerHTML = html;
});