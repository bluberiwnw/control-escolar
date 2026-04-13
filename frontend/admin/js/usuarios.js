document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarProfesores();
    await cargarEstudiantes();
});

async function cargarProfesores() {
    try {
        const lista = await apiRequest('/admin/usuarios?rol=profesor');
        const profesores = lista.filter((p) => p.rol === 'profesor');
        const container = document.getElementById('listaProfesores');
        if (profesores.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay profesores registrados.</div>';
            return;
        }
        container.innerHTML = `<table class="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Acciones</th></tr></thead><tbody>
            ${profesores
                .map(
                    (p) => `<tr>
                <td data-label="Nombre">${p.nombre}</td>
                <td data-label="Email">${p.email}</td>
                <td data-label="Rol">${p.rol}</td>
                <td data-label="Acciones"><button type="button" class="btn btn-danger btn-sm" onclick="eliminarUsuario(${p.id},'profesor')">Eliminar</button></td>
            </tr>`
                )
                .join('')}
        </tbody></table>`;
    } catch (e) {
        document.getElementById('listaProfesores').innerHTML = '<p class="alert alert-error">Error al cargar profesores.</p>';
    }
}

async function cargarEstudiantes() {
    try {
        const estudiantes = await apiRequest('/admin/usuarios?rol=alumno');
        const container = document.getElementById('listaEstudiantes');
        if (estudiantes.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay estudiantes registrados.</div>';
            return;
        }
        container.innerHTML = `<table class="data-table"><thead><tr><th>Matrícula</th><th>Nombre</th><th>Email</th><th>Acciones</th></tr></thead><tbody>
            ${estudiantes
                .map(
                    (e) => `<tr>
                <td data-label="Matrícula">${e.matricula}</td>
                <td data-label="Nombre">${e.nombre}</td>
                <td data-label="Email">${e.email}</td>
                <td data-label="Acciones"><button type="button" class="btn btn-danger btn-sm" onclick="eliminarUsuario(${e.id},'alumno')">Eliminar</button></td>
            </tr>`
                )
                .join('')}
        </tbody></table>`;
    } catch (e) {
        document.getElementById('listaEstudiantes').innerHTML = '<p class="alert alert-error">Error al cargar estudiantes.</p>';
    }
}

async function eliminarUsuario(id, tipo) {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    await apiRequest(`/admin/usuarios/${id}/${tipo}`, { method: 'DELETE' });
    mostrarToast('Usuario eliminado', 'success');
    if (tipo === 'profesor') cargarProfesores();
    else cargarEstudiantes();
}

function abrirModalProfesor() {
    document.getElementById('modalProfesor').style.display = 'flex';
    document.getElementById('profNombre').value = '';
    document.getElementById('profEmail').value = '';
    document.getElementById('profPass').value = '';
}

function cerrarModalProfesor() {
    document.getElementById('modalProfesor').style.display = 'none';
}

async function guardarProfesor(ev) {
    ev.preventDefault();
    await apiRequest('/admin/profesores', {
        method: 'POST',
        body: JSON.stringify({
            nombre: document.getElementById('profNombre').value.trim(),
            email: document.getElementById('profEmail').value.trim(),
            password: document.getElementById('profPass').value,
            rol: 'profesor',
        }),
    });
    mostrarToast('Profesor creado', 'success');
    cerrarModalProfesor();
    cargarProfesores();
}

function abrirModalEstudiante() {
    document.getElementById('modalEstudiante').style.display = 'flex';
    document.getElementById('estMatricula').value = '';
    document.getElementById('estNombre').value = '';
    document.getElementById('estEmail').value = '';
    document.getElementById('estPass').value = '';
}

function cerrarModalEstudiante() {
    document.getElementById('modalEstudiante').style.display = 'none';
}

async function guardarEstudiante(ev) {
    ev.preventDefault();
    await apiRequest('/admin/estudiantes', {
        method: 'POST',
        body: JSON.stringify({
            matricula: document.getElementById('estMatricula').value.trim(),
            nombre: document.getElementById('estNombre').value.trim(),
            email: document.getElementById('estEmail').value.trim(),
            password: document.getElementById('estPass').value,
        }),
    });
    mostrarToast('Estudiante creado', 'success');
    cerrarModalEstudiante();
    cargarEstudiantes();
}

window.abrirModalProfesor = abrirModalProfesor;
window.cerrarModalProfesor = cerrarModalProfesor;
window.guardarProfesor = guardarProfesor;
window.abrirModalEstudiante = abrirModalEstudiante;
window.cerrarModalEstudiante = cerrarModalEstudiante;
window.guardarEstudiante = guardarEstudiante;
window.eliminarUsuario = eliminarUsuario;
