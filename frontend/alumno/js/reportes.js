document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const stats = await apiRequest('/alumno/reportes');
    document.getElementById('reportesStats').innerHTML = `
        <div class="stat-card-profesor"><div class="stat-info"><h3>Promedio general</h3><span class="stat-number">${stats.promedio_general}</span></div></div>
        <div class="stat-card-profesor"><div class="stat-info"><h3>Asistencia global</h3><span class="stat-number">${stats.asistencia_global}%</span></div></div>
    `;
    // Gráfico simple (podrías usar Chart.js)
    document.getElementById('reportesGraficos').innerHTML = `<div class="reporte-card"><h3>Distribución de calificaciones</h3><div>${stats.distribucion}</div></div>`;
});