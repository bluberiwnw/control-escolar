document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    try {
        const [materias, reportes] = await Promise.all([
            apiRequest('/alumno/materias'),
            apiRequest('/alumno/reportes')
        ]);
        document.getElementById('statsAlumno').innerHTML = `
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#2196F310;color:#2196F3;"><i class="fas fa-book-open"></i></div><div class="stat-info"><h3>Materias inscritas</h3><span class="stat-number">${materias.length}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#FF980010;color:#FF9800;"><i class="fas fa-star"></i></div><div class="stat-info"><h3>Promedio general</h3><span class="stat-number">${reportes.promedio_general}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#4CAF5010;color:#4CAF50;"><i class="fas fa-calendar-check"></i></div><div class="stat-info"><h3>Asistencia</h3><span class="stat-number">${reportes.asistencia_global}%</span></div></div>
        `;
        const container = document.getElementById('materiasContainer');
        if (materias.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No estás inscrito en ninguna materia.</div>';
        } else {
            container.innerHTML = materias.map(m => `
                <div class="course-card"><div class="course-header" style="background:${m.color || '#003366'}"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
                <div class="course-body"><div class="course-detail">Horario: ${m.horario || 'No definido'}</div><div class="course-detail">Promedio: ${m.promedio || 'N/A'}</div></div>
                <div class="course-footer"><button class="btn-course" onclick="verMateria(${m.id})">Ver Detalles</button></div></div>
            `).join('');
        }
    } catch (error) { console.error(error); }
});
function verMateria(id) { localStorage.setItem('materiaActual', id); window.location.href = 'actividades.html'; }