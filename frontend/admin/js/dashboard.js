document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    try {
        const stats = await apiRequest('/admin/stats');
        document.getElementById('statsAdmin').innerHTML = `
            <div class="stat-card-profesor"><div class="stat-info"><h3>Profesores</h3><span class="stat-number">${stats.profesores}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-info"><h3>Estudiantes</h3><span class="stat-number">${stats.estudiantes}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-info"><h3>Materias</h3><span class="stat-number">${stats.materias}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-info"><h3>Actividades</h3><span class="stat-number">${stats.actividades}</span></div></div>
        `;
    } catch (error) {
        console.error(error);
    }
});