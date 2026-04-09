document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    try {
        const materias = await apiRequest('/alumno/materias');
        const totalMaterias = materias.length;
        const reportes = await apiRequest('/alumno/reportes');
        document.getElementById('statsAlumno').innerHTML = `
            <div class="stat-card-profesor"><div class="stat-info"><h3>Materias</h3><span class="stat-number">${totalMaterias}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-info"><h3>Promedio</h3><span class="stat-number">${reportes.promedio_general}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-info"><h3>Asistencia</h3><span class="stat-number">${reportes.asistencia_global}%</span></div></div>
        `;
        // Últimas actividades
        const actividades = await apiRequest('/alumno/actividades');
        const ultimas = actividades.slice(0, 3);
        document.getElementById('ultimasActividades').innerHTML = ultimas.map(a => `
            <div class="actividad-card"><div class="actividad-titulo">${a.titulo}</div><div class="actividad-descripcion">${a.descripcion}</div><div class="actividad-meta">Entrega: ${formatearFecha(a.fecha_entrega)}</div></div>
        `).join('');
    } catch (error) { console.error(error); }
});