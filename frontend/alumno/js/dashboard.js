let chartAlumno;
let lastCalfs = [];

function chartOptionsAlumno() {
    const tc = typeof chartTextColor === 'function' ? chartTextColor() : '#334155';
    const gc = typeof chartGridColor === 'function' ? chartGridColor() : 'rgba(0,0,0,0.06)';
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tc } } },
        scales: {
            r: {
                angleLines: { color: gc },
                grid: { color: gc },
                pointLabels: { color: tc },
                ticks: { color: tc, backdropColor: 'transparent' },
                suggestedMin: 0,
                suggestedMax: 10,
            },
        },
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();

    try {
        const actividades = await apiRequest('/alumno/actividades');
        const reportes = await apiRequest('/alumno/reportes');
        const materias = await apiRequest('/alumno/materias');

        const pendientes = actividades.filter((a) => !a.entregado).length;

        document.getElementById('statsAlumno').innerHTML = `
            <div class="kpi-card kpi-card--violet">
                <span class="kpi-card__label">Promedio general</span>
                <span class="kpi-card__value">${Number(reportes.promedio_general || 0).toFixed(1)}</span>
            </div>
            <div class="kpi-card kpi-card--amber">
                <span class="kpi-card__label">Tareas pendientes</span>
                <span class="kpi-card__value">${pendientes}</span>
            </div>
            <div class="kpi-card kpi-card--teal">
                <span class="kpi-card__label">Asistencia</span>
                <span class="kpi-card__value">${reportes.asistencia_global}%</span>
            </div>`;

        const container = document.getElementById('materiasContainer');
        if (container) {
            if (!materias.length) {
                container.innerHTML = '<div class="alert alert-info">No estás inscrito en materias todavía.</div>';
            } else {
                container.innerHTML = materias
                    .map(
                        (m) => `
                <div class="course-card">
                    <div class="course-header"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
                    <div class="course-body">
                        <div class="course-detail">Profesor: ${m.profesor_nombre || '—'}</div>
                        <div class="course-detail">Horario: ${m.horario || '—'}</div>
                    </div>
                    <div class="course-footer course-footer--split"><button type="button" class="btn btn-primary btn-sm" onclick="verMateria(${m.id})">Ver detalles</button></div>
                </div>`
                    )
                    .join('');
            }
        }

        const ultimas = document.getElementById('ultimasActividades');
        if (ultimas) {
            const slice = actividades.slice(0, 5);
            ultimas.innerHTML = slice.length
                ? slice
                      .map(
                          (a) => `
                <div class="actividad-card">
                    <div class="actividad-titulo">${a.titulo}</div>
                    <div class="actividad-meta"><span>${a.materia_nombre}</span> · <span>Entrega: ${formatearFecha(a.fecha_entrega)}</span></div>
                </div>`
                      )
                      .join('')
                : '<p class="text-muted">Sin actividades recientes.</p>';
        }

        lastCalfs = await apiRequest('/alumno/calificaciones');
        renderAlumnoChart();
    } catch (e) {
        const s = document.getElementById('statsAlumno');
        if (s) s.innerHTML = '<p class="alert alert-error">No se pudo cargar tu panel.</p>';
    }
});

function verMateria(id) {
    localStorage.setItem('materiaActual', id);
    window.location.href = 'actividades.html';
}

window.verMateria = verMateria;

function renderAlumnoChart() {
    const canvas = document.getElementById('graficoAlumno');
    if (!canvas || typeof Chart === 'undefined') return;
    const calificaciones = lastCalfs;
    const labels = calificaciones.map((c) => c.materia_nombre);
    const data = calificaciones.map((c) => parseFloat(c.calificacion));
    if (chartAlumno) chartAlumno.destroy();
    chartAlumno = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: {
            labels: labels.length ? labels : ['Sin datos'],
            datasets: [
                {
                    label: 'Competencias por materia',
                    data: data.length ? data : [0],
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderColor: 'rgb(99, 102, 241)',
                    pointBackgroundColor: 'rgb(99, 102, 241)',
                },
            ],
        },
        options: chartOptionsAlumno(),
    });
}

window.addEventListener('themechange', () => renderAlumnoChart());
