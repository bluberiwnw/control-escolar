document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const stats = await apiRequest('/alumno/reportes');
    document.getElementById('reportesStats').innerHTML = `
        <div class="stat-card-profesor"><div class="stat-info"><h3>Promedio general</h3><span class="stat-number">${stats.promedio_general}</span></div></div>
        <div class="stat-card-profesor"><div class="stat-info"><h3>Asistencia global</h3><span class="stat-number">${stats.asistencia_global}%</span></div></div>
    `;
    const d = stats.distribucion || {};
    document.getElementById('reportesGraficos').innerHTML = `<div class="reporte-card"><h3>Distribución de calificaciones</h3>
        <div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Rango</th><th>Cantidad</th></tr></thead><tbody>
            <tr><td data-label="Rango">9.0 - 10</td><td data-label="Cantidad">${d.rango_9_10 || 0}</td></tr>
            <tr><td data-label="Rango">8.0 - 8.9</td><td data-label="Cantidad">${d.rango_8_9 || 0}</td></tr>
            <tr><td data-label="Rango">7.0 - 7.9</td><td data-label="Cantidad">${d.rango_7_8 || 0}</td></tr>
            <tr><td data-label="Rango">6.0 - 6.9</td><td data-label="Cantidad">${d.rango_6_7 || 0}</td></tr>
            <tr><td data-label="Rango">Menor a 6</td><td data-label="Cantidad">${d.rango_menor_6 || 0}</td></tr>
        </tbody></table></div>
    </div>`;
});