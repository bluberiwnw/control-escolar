document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    try {
        const stats = await apiRequest('/admin/stats');
        document.getElementById('statsAdmin').innerHTML = `
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#2196F310;color:#2196F3;"><i class="fas fa-chalkboard-user"></i></div><div class="stat-info"><h3>Profesores</h3><span class="stat-number">${stats.profesores}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#4CAF5010;color:#4CAF50;"><i class="fas fa-user-graduate"></i></div><div class="stat-info"><h3>Estudiantes</h3><span class="stat-number">${stats.estudiantes}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#FF980010;color:#FF9800;"><i class="fas fa-book"></i></div><div class="stat-info"><h3>Materias</h3><span class="stat-number">${stats.materias}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#9C27B010;color:#9C27B0;"><i class="fas fa-tasks"></i></div><div class="stat-info"><h3>Actividades</h3><span class="stat-number">${stats.actividades}</span></div></div>
        `;
    } catch (error) {
        console.error(error);
        document.getElementById('statsAdmin').innerHTML = '<div class="alert alert-error">Error al cargar estadísticas</div>';
    }
});