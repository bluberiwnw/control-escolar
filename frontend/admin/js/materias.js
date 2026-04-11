document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarMaterias();
});
async function cargarMaterias() {
    try {
        const materias = await apiRequest('/admin/materias');
        const container = document.getElementById('materiasContainer');
        if (materias.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No hay materias registradas.</div>';
            return;
        }
        container.innerHTML = materias.map(m => `
            <div class="course-card">
                <div class="course-header" style="background:${m.color || '#003366'}"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
                <div class="course-body">
                    <div class="course-detail">Profesor: ${m.profesor_nombre || 'No asignado'}</div>
                    <div class="course-detail">Horario: ${m.horario || 'No definido'}</div>
                    <div class="course-detail">Estudiantes: ${m.estudiantes || 0}</div>
                </div>
                <div class="course-footer"><button class="btn-course" onclick="eliminarMateria(${m.id})">Eliminar</button></div>
            </div>
        `).join('');
    } catch (error) {
        console.error(error);
        document.getElementById('materiasContainer').innerHTML = '<div class="alert alert-error">Error al cargar materias</div>';
    }
}
async function eliminarMateria(id) {
    if (confirm('¿Eliminar materia?')) {
        await apiRequest(`/admin/materias/${id}`, { method: 'DELETE' });
        cargarMaterias();
    }
}

async function mostrarModalMateria() {
    const profesores = await apiRequest('/admin/usuarios?rol=profesor');
    const modal = document.getElementById('modalMateria');
    document.getElementById('selectProfesor').innerHTML = profesores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    modal.style.display = 'flex';
}
async function guardarMateria() {
    const data = {
        nombre: document.getElementById('nombreMateria').value,
        clave: document.getElementById('claveMateria').value,
        horario: document.getElementById('horarioMateria').value,
        semestre: document.getElementById('semestreMateria').value,
        color: document.getElementById('colorMateria').value,
        profesor_id: parseInt(document.getElementById('selectProfesor').value)
    };
    await apiRequest('/admin/materias', { method: 'POST', body: JSON.stringify(data) });
    cerrarModal();
    cargarMaterias();
}