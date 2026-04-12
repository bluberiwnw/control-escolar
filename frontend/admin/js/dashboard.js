async function cargarGraficos() {
    const stats = await apiRequest('/admin/stats');
    const ctx = document.getElementById('graficoBarras').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Profesores', 'Estudiantes', 'Materias', 'Actividades'],
            datasets: [{
                label: 'Cantidad',
                data: [stats.profesores, stats.estudiantes, stats.materias, stats.actividades],
                backgroundColor: '#003366',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'top' } }
        }
    });
}

// Llamar después de cargar estadísticas
document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    const stats = await apiRequest('/admin/stats');
    document.getElementById('statsAdmin').innerHTML = `...`; // el código que ya tenías
    cargarGraficos();
});