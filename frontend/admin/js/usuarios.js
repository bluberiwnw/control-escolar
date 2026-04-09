document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarProfesores();
    await cargarEstudiantes();
});
async function cargarProfesores() {
    try {
        const profesores = await apiRequest('/admin/usuarios?rol=profesor');
        const container = document.getElementById('listaProfesores');
        if (profesores.length === 0) { container.innerHTML = '<p>No hay profesores.</p>'; return; }
        container.innerHTML = `<table><thead><tr><th>Nombre</th><th>Email</th><th>Acciones</th></tr></thead><tbody>
            ${profesores.map(p => `<tr><td>${p.nombre}</td><td>${p.email}</td><td><button onclick="eliminarUsuario(${p.id},'profesor')">Eliminar</button></td></tr>`).join('')}
        </tbody>~`;
    } catch (error) { console.error(error); }
}
async function cargarEstudiantes() {
    try {
        const estudiantes = await apiRequest('/admin/usuarios?rol=alumno');
        const container = document.getElementById('listaEstudiantes');
        if (estudiantes.length === 0) { container.innerHTML = '<p>No hay estudiantes.</p>'; return; }
        container.innerHTML = `<table><thead><tr><th>Matrícula</th><th>Nombre</th><th>Email</th><th>Acciones</th></tr></thead><tbody>
            ${estudiantes.map(e => `<tr><td>${e.matricula}</td><td>${e.nombre}</td><td>${e.email}</td><td><button onclick="eliminarUsuario(${e.id},'alumno')">Eliminar</button></td></tr>`).join('')}
        </tbody></table>`;
    } catch (error) { console.error(error); }
}
async function eliminarUsuario(id, tipo) {
    if (confirm('¿Eliminar usuario?')) {
        await apiRequest(`/admin/usuarios/${id}?tipo=${tipo}`, { method: 'DELETE' });
        if (tipo === 'profesor') cargarProfesores(); else cargarEstudiantes();
    }
}