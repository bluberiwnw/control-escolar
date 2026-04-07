document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const stats = await apiRequest('/admin/reportes');
    document.getElementById('reportesStats').innerHTML = `
        <div class="stat-card-profesor"><div class="stat-info"><h3>Promedio general</h3><span class="stat-number">${stats.promedio_general || 0}</span></div></div>
        <div class="stat-card-profesor"><div class="stat-info"><h3>Aprobación global</h3><span class="stat-number">${stats.aprobacion_global || 0}%</span></div></div>
    `;
    document.getElementById('reportesGraficos').innerHTML = `<div class="reporte-card"><h3>Materias con mejor rendimiento</h3><ul>${stats.top_materias.map(m => `<li>${m.nombre} - ${m.promedio}</li>`).join('')}</ul></div>`;
});