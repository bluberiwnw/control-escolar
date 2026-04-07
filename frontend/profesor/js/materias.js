document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const materias = await apiRequest('/materias');
    document.getElementById('materiasContainer').innerHTML = materias.map(m => `
        <div class="course-card"><div class="course-header" style="background:${m.color || '#667eea'}"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
        <div class="course-body"><div class="course-detail"><i class="fas fa-clock"></i> ${m.horario}</div><div class="course-detail"><i class="fas fa-user-check"></i> ${m.estudiantes} activos</div></div>
        <div class="course-footer"><button class="btn-course" onclick="verMateria(${m.id})">Ver Detalles</button></div></div>
    `).join('');
});
function verMateria(id) { localStorage.setItem('materiaActual', id); window.location.href = 'actividades.html'; }