document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarProfesores();
    await cargarAdministradores();
    await cargarEstudiantes();
});

async function cargarProfesores() {
    const profesores = await apiRequest('/admin/usuarios?rol=profesor');
    document.getElementById('listaProfesores').innerHTML = `
        <table><thead><tr><th>Nombre</th><th>Email</th><th>Acciones</th></tr></thead><tbody>
        ${profesores.map(p => `<tr><td>${p.nombre}</td><td>${p.email}</td><td><button onclick="eliminarUsuario(${p.id},'profesor')">Eliminar</button></td></tr>`).join('')}
        </tbody></table>
    `;
}

async function cargarAdministradores() {
    const administradores = await apiRequest('/admin/usuarios?rol=admin');
    document.getElementById('listaAdministradores').innerHTML = `
        <table><thead><tr><th>Nombre</th><th>Email</th><th>Acciones</th></tr></thead><tbody>
        ${administradores.map(a => `<tr><td>${a.nombre}</td><td>${a.email}</td><td><button onclick="eliminarUsuario(${a.id},'administrador')">Eliminar</button></td></tr>`).join('')}
        </tbody></table>
    `;
}

async function cargarEstudiantes() {
    const estudiantes = await apiRequest('/admin/usuarios?rol=alumno');
    document.getElementById('listaEstudiantes').innerHTML = `
        <table><thead><tr><th>Matrícula</th><th>Nombre</th><th>Email</th><th>Acciones</th></tr></thead><tbody>
        ${estudiantes.map(e => `<tr><td>${e.matricula}</td><td>${e.nombre}</td><td>${e.email}</td><td><button onclick="eliminarUsuario(${e.id},'alumno')">Eliminar</button></td></tr>`).join('')}  
        </tbody></table>
    `;
}

async function eliminarUsuario(id, tipo) {
    if (confirm('¿Eliminar usuario?')) {
        await apiRequest(`/admin/usuarios/${id}?tipo=${tipo}`, { method: 'DELETE' });
        if (tipo === 'profesor') cargarProfesores();
        else if (tipo === 'administrador') cargarAdministradores();
        else cargarEstudiantes();
    }
}

// Exponer funciones globales
window.eliminarUsuario = eliminarUsuario;
window.editarProfesor = editarProfesor;
window.editarEstudiante = editarEstudiante;
window.togglePassword = togglePassword;
window.cambiarContrasena = cambiarContrasena;
window.cerrarModalCambiarContrasena = cerrarModalCambiarContrasena;
window.handleCambiarContrasena = handleCambiarContrasena;
window.abrirModalAdministrador = abrirModalAdministrador;
window.cerrarModalAdministrador = cerrarModalAdministrador;
window.guardarAdministrador = guardarAdministrador;
