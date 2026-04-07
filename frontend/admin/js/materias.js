document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarMaterias();
});

async function cargarMaterias() {
    const materias = await apiRequest('/admin/materias');
    document.getElementById('materiasContainer').innerHTML = materias.map(m => `
        <div class="course-card"><div class="course-header" style="background:${m.color || '#667eea'}"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
        <div class="course-body"><div class="course-detail">Profesor: ${m.profesor_nombre || 'N/A'}</div><div class="course-detail">Horario: ${m.horario}</div></div>
        <div class="course-footer"><button class="btn-course" onclick="eliminarMateria(${m.id})">Eliminar</button></div></div>
    `).join('');
}

async function eliminarMateria(id) {
    if (confirm('¿Eliminar materia?')) {
        await apiRequest(`/admin/materias/${id}`, { method: 'DELETE' });
        cargarMaterias();
    }
}