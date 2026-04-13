let chartAdmin;
let lastAdminStats;

function buildAdminChartOptions() {
    const tc = typeof chartTextColor === 'function' ? chartTextColor() : '#334155';
    const gc = typeof chartGridColor === 'function' ? chartGridColor() : 'rgba(0,0,0,0.06)';
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: tc } },
        },
        scales: {
            x: { ticks: { color: tc }, grid: { color: gc } },
            y: { ticks: { color: tc }, grid: { color: gc }, beginAtZero: true },
        },
    };
}

async function renderAdminChart(stats) {
    const canvas = document.getElementById('graficoBarras');
    if (!canvas || typeof Chart === 'undefined') return;
    const grupos = stats.alumnos_por_grado || [];
    const labels = grupos.length ? grupos.map((g) => g.grado || 'N/D') : ['Sin datos'];
    const data = grupos.length ? grupos.map((g) => g.total) : [0];
    if (chartAdmin) chartAdmin.destroy();
    chartAdmin = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Alumnos por cohorte (matrícula)',
                    data,
                    backgroundColor: 'rgba(59, 130, 246, 0.65)',
                    borderRadius: 10,
                },
            ],
        },
        options: buildAdminChartOptions(),
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();

    try {
        const stats = await apiRequest('/admin/stats');
        lastAdminStats = stats;
        const pendientes = stats.actividades || 0;
        document.getElementById('statsAdmin').innerHTML = `
            <div class="kpi-card kpi-card--violet">
                <span class="kpi-card__label">Estudiantes</span>
                <span class="kpi-card__value">${stats.estudiantes}</span>
            </div>
            <div class="kpi-card kpi-card--teal">
                <span class="kpi-card__label">Materias activas</span>
                <span class="kpi-card__value">${stats.materias}</span>
            </div>
            <div class="kpi-card kpi-card--amber">
                <span class="kpi-card__label">Actividades</span>
                <span class="kpi-card__value">${pendientes}</span>
            </div>
            <div class="kpi-card kpi-card--rose">
                <span class="kpi-card__label">Profesores</span>
                <span class="kpi-card__value">${stats.profesores}</span>
            </div>`;
        await renderAdminChart(stats);
    } catch (e) {
        const el = document.getElementById('statsAdmin');
        if (el) el.innerHTML = '<p class="alert alert-error">No se pudieron cargar las estadísticas.</p>';
    }

    window.addEventListener('themechange', () => {
        if (lastAdminStats) renderAdminChart(lastAdminStats);
    });
});
