document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarDashboard();
});

async function cargarDashboard() {
    try {
        const materias = await apiRequest('/materias');
        const totalEstudiantes = materias.reduce((sum, m) => sum + (m.estudiantes || 0), 0);
        const promedioGeneral = materias.length ? (materias.reduce((sum, m) => sum + (m.promedio || 0), 0) / materias.length).toFixed(1) : 0;
        document.getElementById('statsContainer').innerHTML = `
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#2196F310;color:#2196F3;"><i class="fas fa-book-open"></i></div><div class="stat-info"><h3>Materias</h3><span class="stat-number">${materias.length}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#4CAF5010;color:#4CAF50;"><i class="fas fa-users"></i></div><div class="stat-info"><h3>Estudiantes</h3><span class="stat-number">${totalEstudiantes}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#FF980010;color:#FF9800;"><i class="fas fa-chart-line"></i></div><div class="stat-info"><h3>Promedio</h3><span class="stat-number">${promedioGeneral}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#9C27B010;color:#9C27B0;"><i class="fas fa-clock"></i></div><div class="stat-info"><h3>Actividades</h3><span class="stat-number">-</span></div></div>
        `;
        document.getElementById('coursesGrid').innerHTML = materias.map(m => `
            <div class="course-card"><div class="course-header" style="background:${m.color || '#667eea'}"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
            <div class="course-body"><div class="course-detail"><i class="fas fa-clock"></i> ${m.horario || 'No definido'}</div>
            <div class="course-detail"><i class="fas fa-user-check"></i> ${m.estudiantes || 0} activos</div>
            <div class="course-detail"><i class="fas fa-star"></i> Promedio: ${m.promedio || 'N/A'}</div></div>
            <div class="course-footer"><button class="btn-course" onclick="verMateria(${m.id})">Ver Detalles</button></div></div>
        `).join('');
    } catch (error) { console.error(error); }
}

function verMateria(id) { localStorage.setItem('materiaActual', id); window.location.href = 'actividades.html'; }