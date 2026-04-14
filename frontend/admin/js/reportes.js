document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const stats = await apiRequest('/admin/reportes');
    document.getElementById('reportesStats').innerHTML = `
        <div class="stat-card-profesor"><div class="stat-info"><h3>Promedio general</h3><span class="stat-number">${stats.promedio_general || 0}</span></div></div>
        <div class="stat-card-profesor"><div class="stat-info"><h3>Alumnos con rendimiento sobresaliente</h3><span class="stat-number">${stats.porcentaje_sobresaliente || 0}%</span></div></div>
    `;
    const materias = stats.materias_rendimiento || [];
    document.getElementById('reportesGraficos').innerHTML = `<div class="reporte-card"><h3>Materias con mejor rendimiento</h3>${materias.length ? `<ul>${materias.map(m => `<li>${m.nombre} - ${Number(m.promedio).toFixed(2)}</li>`).join('')}</ul>` : '<p>No hay datos disponibles.</p>'}</div>`;
});