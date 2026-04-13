let chartProfesor;
let lastEvolucion = [];

function kpiCard(cls, label, value) {
    return `<div class="kpi-card ${cls}"><span class="kpi-card__label">${label}</span><span class="kpi-card__value">${value}</span></div>`;
}

function chartOptionsProfesor() {
    const tc = typeof chartTextColor === 'function' ? chartTextColor() : '#334155';
    const gc = typeof chartGridColor === 'function' ? chartGridColor() : 'rgba(0,0,0,0.06)';
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tc } } },
        scales: {
            x: { ticks: { color: tc }, grid: { color: gc } },
            y: { ticks: { color: tc }, grid: { color: gc }, beginAtZero: true, max: 10 },
        },
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();

    try {
        const stats = await apiRequest('/profesores/estadisticas');
        const kpi = document.getElementById('kpiProfesor');
        if (kpi) {
            kpi.innerHTML =
                kpiCard('kpi-card--violet', 'Materias', stats.totalMaterias) +
                kpiCard('kpi-card--teal', 'Alumnos (aprox.)', stats.totalEstudiantes) +
                kpiCard('kpi-card--amber', 'Promedio general', stats.promedioGeneral) +
                kpiCard('kpi-card--rose', 'Tareas pendientes', stats.actividadesActivas);
        }

        const materias = await apiRequest('/materias');
        const grid = document.getElementById('coursesGrid');
        if (grid) {
            grid.innerHTML = materias
                .map(
                    (m) => `
            <div class="course-card">
                <div class="course-header"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
                <div class="course-body">
                    <div class="course-detail"><i class="fas fa-clock"></i> ${m.horario || 'Horario por definir'}</div>
                    <div class="course-detail"><i class="fas fa-user-check"></i> ${m.estudiantes || 0} alumnos</div>
                    <div class="course-detail"><i class="fas fa-star"></i> Promedio: ${m.promedio ?? '—'}</div>
                </div>
                <div class="course-footer course-footer--split"><button type="button" class="btn btn-primary btn-sm" onclick="verMateria(${m.id})">Ver detalles</button></div>
            </div>`
                )
                .join('');
        }

        lastEvolucion = await apiRequest('/profesores/calificaciones-evolucion');
        renderProfesorChart();
    } catch (err) {
        const kpi = document.getElementById('kpiProfesor');
        if (kpi) kpi.innerHTML = '<p class="alert alert-error">Error al cargar el dashboard.</p>';
    }
});

function verMateria(id) {
    localStorage.setItem('materiaActual', id);
    window.location.href = 'actividades.html';
}

window.verMateria = verMateria;

function renderProfesorChart() {
    const canvas = document.getElementById('graficoProfesor');
    if (!canvas || typeof Chart === 'undefined') return;
    const evolucion = lastEvolucion;
    const labels = evolucion.length ? evolucion.map((r) => r.mes) : ['Sin registros'];
    const vals = evolucion.length ? evolucion.map((r) => parseFloat(r.promedio)) : [0];
    if (chartProfesor) chartProfesor.destroy();
    chartProfesor = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Promedio mensual',
                    data: vals,
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    fill: true,
                    tension: 0.35,
                },
            ],
        },
        options: chartOptionsProfesor(),
    });
}

window.addEventListener('themechange', () => renderProfesorChart());
