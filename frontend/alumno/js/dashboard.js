document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarDashboard();
});

async function cargarDashboard() {
    try {
        const materias = await apiRequest('/alumno/materias'); // Endpoint esperado
        const totalMaterias = materias.length;
        const promedioGeneral = materias.length
            ? (materias.reduce((sum, m) => sum + (m.promedio || 0), 0) / materias.length).toFixed(1)
            : 0;
        const asistencias = await apiRequest('/alumno/asistencias/resumen'); // Endpoint esperado
        const asistenciaPromedio = asistencias.promedio || 0;

        document.getElementById('statsAlumno').innerHTML = `
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#2196F310;color:#2196F3;"><i class="fas fa-book-open"></i></div><div class="stat-info"><h3>Materias</h3><span class="stat-number">${totalMaterias}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#FF980010;color:#FF9800;"><i class="fas fa-chart-line"></i></div><div class="stat-info"><h3>Promedio</h3><span class="stat-number">${promedioGeneral}</span></div></div>
            <div class="stat-card-profesor"><div class="stat-icon" style="background:#4CAF5010;color:#4CAF50;"><i class="fas fa-calendar-check"></i></div><div class="stat-info"><h3>Asistencia</h3><span class="stat-number">${asistenciaPromedio}%</span></div></div>
        `;

        const actividades = await apiRequest('/alumno/actividades/recientes');
        document.getElementById('ultimasActividades').innerHTML = actividades.map(a => `
            <div class="actividad-card"><div class="actividad-titulo">${a.titulo}</div><div class="actividad-descripcion">${a.descripcion}</div><div class="actividad-meta"><span><i class="fas fa-calendar"></i> Entrega: ${formatearFecha(a.fecha_entrega)}</span></div></div>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}