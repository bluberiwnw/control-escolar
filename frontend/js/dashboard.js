// dashboard.js

function cargarDashboard() {
    const usuario = obtenerUsuarioActual(); // esta función viene de auth.js
    if (!usuario) return;

    // Obtener materias del localStorage (guardadas en el login)
    let materias = [];
    try {
        materias = JSON.parse(localStorage.getItem('materiasProfesor')) || [];
    } catch (e) {
        console.error('Error parsing materias', e);
    }

    // Actualizar estadísticas
    document.getElementById('totalMaterias').textContent = materias.length;

    const totalEstudiantes = materias.reduce((acc, m) => acc + (m.estudiantes || 0), 0);
    document.getElementById('totalEstudiantes').textContent = totalEstudiantes;

    const promedioGeneral = materias.length > 0
        ? (materias.reduce((acc, m) => acc + (m.promedio || 0), 0) / materias.length).toFixed(1)
        : '0.0';
    document.getElementById('promedioGeneral').textContent = promedioGeneral;

    // Actividades activas (simulado)
    document.getElementById('actividadesActivas').textContent = '12';

    // Cargar materias en el grid
    const coursesGrid = document.getElementById('coursesGrid');
    if (!coursesGrid) return;

    if (materias.length === 0) {
        coursesGrid.innerHTML = '<div class="alert alert-info">No tienes materias asignadas</div>';
    } else {
        coursesGrid.innerHTML = materias.map(materia => `
            <div class="course-card">
                <div class="course-header" style="background: ${materia.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}">
                    <h3>${materia.nombre}</h3>
                    <p>${materia.clave}</p>
                </div>
                <div class="course-body">
                    <div class="course-detail">
                        <i class="fas fa-clock"></i>
                        <span>${materia.horario || 'Horario no definido'}</span>
                    </div>
                    <div class="course-detail">
                        <i class="fas fa-user-check"></i>
                        <span>${materia.estudiantes || 0} activos • ${materia.bajas || 0} bajas</span>
                    </div>
                    <div class="course-detail">
                        <i class="fas fa-calendar"></i>
                        <span>${materia.semestre || 'Semestre actual'}</span>
                    </div>
                    <div class="course-detail">
                        <i class="fas fa-star"></i>
                        <span>Promedio: <strong>${materia.promedio || 'N/A'}</strong></span>
                    </div>
                </div>
                <div class="course-footer">
                    <button class="btn-course" onclick="verDetalleMateria(${materia.id})">
                        Ver Detalles
                    </button>
                </div>
            </div>
        `).join('');
    }
}

// Función para ver detalle de una materia (puedes implementarla luego)
function verDetalleMateria(id) {
    localStorage.setItem('materiaActual', id);
    window.location.href = 'actividades.html';
}

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión (auth.js ya lo hace, pero también podemos llamar a verificarSesion)
    const usuario = verificarSesion(); // definida en auth.js
    if (usuario) {
        cargarDashboard();
    }
});