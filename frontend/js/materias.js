// materias.js
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = verificarSesion();
    if (!usuario) return;

    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMaterias();
});

async function cargarMaterias() {
    const container = document.getElementById('materiasContainer');
    container.innerHTML = '<div class="spinner"></div>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(window.API_URL + '/materias', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al cargar materias');

        const materias = await response.json();

        if (materias.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No tienes materias asignadas.</div>';
            return;
        }

        container.innerHTML = materias.map(m => `
            <div class="course-card">
                <div class="course-header" style="background: ${m.color}">
                    <h3>${m.nombre}</h3>
                    <p>${m.clave}</p>
                </div>
                <div class="course-body">
                    <div class="course-detail"><i class="fas fa-clock"></i> ${m.horario}</div>
                    <div class="course-detail"><i class="fas fa-user-check"></i> ${m.estudiantes} activos • ${m.bajas} bajas</div>
                    <div class="course-detail"><i class="fas fa-calendar"></i> ${m.semestre}</div>
                    <div class="course-detail"><i class="fas fa-star"></i> Promedio: <strong>${m.promedio}</strong></div>
                </div>
                <div class="course-footer">
                    <button class="btn-course" onclick="verMateria(${m.id})">Ver Detalles</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
    }
}

function verMateria(id) {
    localStorage.setItem('materiaActual', id);
    window.location.href = 'actividades.html';
}