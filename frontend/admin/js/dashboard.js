document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    try {
        const stats = await apiRequest('/admin/stats');
        document.getElementById('statsAdmin').innerHTML = `
            <div class="stat-card-profesor"><div class="stat-info"><h3>Profesores</h3><span class="stat-number">${stats.profesores || 0}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-info"><h3>Estudiantes</h3><span class="stat-number">${stats.estudiantes || 0}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-info"><h3>Materias</h3><span class="stat-number">${stats.materias || 0}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-info"><h3>Actividades</h3><span class="stat-number">${stats.actividades || 0}</span></div></div>
        `;
    } catch (error) { console.error(error); }
});