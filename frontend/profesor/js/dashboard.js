document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    try {
        const stats = await apiRequest('/profesores/estadisticas');
        document.getElementById('totalMaterias').textContent = stats.totalMaterias;
        document.getElementById('totalEstudiantes').textContent = stats.totalEstudiantes;
        document.getElementById('promedioGeneral').textContent = stats.promedioGeneral;
        document.getElementById('actividadesActivas').textContent = stats.actividadesActivas;
        const materias = await apiRequest('/materias');
        const grid = document.getElementById('coursesGrid');
        grid.innerHTML = materias.map(m => `
            <div class="course-card">
                <div class="course-header" style="background:${m.color || '#003366'}"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
                <div class="course-body">
                    <div class="course-detail"><i class="fas fa-clock"></i> ${m.horario || 'No definido'}</div>
                    <div class="course-detail"><i class="fas fa-user-check"></i> ${m.estudiantes || 0} activos</div>
                    <div class="course-detail"><i class="fas fa-star"></i> Promedio: ${m.promedio || 'N/A'}</div>
                </div>
                <div class="course-footer"><button class="btn-course" onclick="verMateria(${m.id})">Ver Detalles</button></div>
            </div>
        `).join('');
    } catch (error) { console.error(error); }
});

function verMateria(id) {
    localStorage.setItem('materiaActual', id);
    window.location.href = 'actividades.html';
}

async function cargarGraficoProfesor() {
    const materias = await apiRequest('/materias');
    const labels = materias.map(m => m.nombre);
    const promedios = materias.map(m => m.promedio || 0);
    const ctx = document.getElementById('graficoProfesor').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Promedio por materia',
                data: promedios,
                backgroundColor: '#003366'
            }]
        }
    });
}
