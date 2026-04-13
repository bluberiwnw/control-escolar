document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const materias = await apiRequest('/alumno/materias');
    if (!materias.length) {
        document.getElementById('materiasContainer').innerHTML = '<div class="empty-state">No tienes materias inscritas.</div>';
        return;
    }
    document.getElementById('materiasContainer').innerHTML = materias.map(m => `
        <div class="course-card course-card--elevated"><div class="course-header"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
        <div class="course-body"><div class="course-detail"><i class="fas fa-clock"></i> ${m.horario || 'No definido'}</div>
        <div class="course-detail"><i class="fas fa-star"></i> Promedio: ${m.promedio || 'N/A'}</div></div>
        <div class="course-footer course-footer--split"><button type="button" class="btn btn-primary btn-sm" onclick="verMateria(${m.id})">Ver detalles</button></div></div>
    `).join('');
});
function verMateria(id) { localStorage.setItem('materiaActual', id); window.location.href = 'actividades.html'; }