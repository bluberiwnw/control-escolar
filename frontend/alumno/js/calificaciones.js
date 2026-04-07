document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const calificaciones = await apiRequest('/alumno/calificaciones');
    let html = '<div class="asistencia-tabla"><table><thead><tr><th>Materia</th><th>Actividad</th><th>Calificación</th><th>Fecha</th></tr></thead><tbody>';
    calificaciones.forEach(c => {
        html += `<tr><td>${c.materia_nombre}</td><td>${c.actividad_titulo || c.tipo}</td><td>${c.calificacion}</td><td>${formatearFecha(c.fecha_registro)}</td></tr>`;
    });
    html += '</tbody></table></div>';
    document.getElementById('calificacionesContainer').innerHTML = html;
});