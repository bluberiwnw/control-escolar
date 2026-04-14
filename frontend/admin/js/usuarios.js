document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarProfesores();
    await cargarEstudiantes();
});

function esCorreoValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function esNombreValido(nombre) {
    const limpio = String(nombre || '').trim();
    return limpio.length >= 3 && limpio.length <= 120;
}

function esMatriculaValida(matricula) {
    return /^[A-Za-z0-9-]{4,20}$/.test(String(matricula || '').trim());
}

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
                <td data-label="Acciones" class="table-actions"><button type="button" class="btn btn-secondary btn-sm" onclick="editarProfesor(${p.id}, '${p.nombre.replace(/'/g, "\\'")}', '${p.email.replace(/'/g, "\\'")}')">Editar</button><button type="button" class="btn btn-danger btn-sm" onclick="eliminarUsuario(${p.id},'profesor')">Eliminar</button></td>
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
                <td data-label="Acciones" class="table-actions"><button type="button" class="btn btn-secondary btn-sm" onclick="editarEstudiante(${e.id}, '${e.matricula.replace(/'/g, "\\'")}', '${e.nombre.replace(/'/g, "\\'")}', '${e.email.replace(/'/g, "\\'")}')">Editar</button><button type="button" class="btn btn-danger btn-sm" onclick="eliminarUsuario(${e.id},'alumno')">Eliminar</button></td>
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

async function editarProfesor(id, nombreActual, emailActual) {
    const nombre = prompt('Nombre del profesor', nombreActual);
    if (!nombre) return;
    const email = prompt('Correo del profesor', emailActual);
    if (!email) return;
    if (!esNombreValido(nombre)) {
        mostrarToast('El nombre debe tener entre 3 y 120 caracteres', 'error');
        return;
    }
    if (!esCorreoValido(email)) {
        mostrarToast('Ingresa un correo electrónico válido', 'error');
        return;
    }
    await apiRequest(`/admin/profesores/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre: nombre.trim(), email: email.trim() }),
    });
    mostrarToast('Profesor actualizado', 'success');
    cargarProfesores();
}

async function editarEstudiante(id, matriculaActual, nombreActual, emailActual) {
    const matricula = prompt('Matrícula del estudiante', matriculaActual);
    if (!matricula) return;
    const nombre = prompt('Nombre del estudiante', nombreActual);
    if (!nombre) return;
    const email = prompt('Correo del estudiante', emailActual);
    if (!email) return;
    if (!esMatriculaValida(matricula)) {
        mostrarToast('La matrícula debe contener entre 4 y 20 caracteres válidos', 'error');
        return;
    }
    if (!esNombreValido(nombre)) {
        mostrarToast('El nombre debe tener entre 3 y 120 caracteres', 'error');
        return;
    }
    if (!esCorreoValido(email)) {
        mostrarToast('Ingresa un correo electrónico válido', 'error');
        return;
    }
    await apiRequest(`/admin/estudiantes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ matricula: matricula.trim(), nombre: nombre.trim(), email: email.trim() }),
    });
    mostrarToast('Estudiante actualizado', 'success');
    cargarEstudiantes();
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
    const nombre = document.getElementById('profNombre').value.trim();
    const email = document.getElementById('profEmail').value.trim();
    const password = document.getElementById('profPass').value;
    if (!esNombreValido(nombre)) {
        mostrarToast('El nombre debe tener entre 3 y 120 caracteres', 'error');
        return;
    }
    if (!esCorreoValido(email)) {
        mostrarToast('Ingresa un correo electrónico válido', 'error');
        return;
    }
    if (password.length < 6) {
        mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    await apiRequest('/admin/profesores', {
        method: 'POST',
        body: JSON.stringify({
            nombre,
            email,
            password,
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
    const matricula = document.getElementById('estMatricula').value.trim();
    const nombre = document.getElementById('estNombre').value.trim();
    const email = document.getElementById('estEmail').value.trim();
    const password = document.getElementById('estPass').value;
    if (!esMatriculaValida(matricula)) {
        mostrarToast('La matrícula debe contener entre 4 y 20 caracteres válidos', 'error');
        return;
    }
    if (!esNombreValido(nombre)) {
        mostrarToast('El nombre debe tener entre 3 y 120 caracteres', 'error');
        return;
    }
    if (!esCorreoValido(email)) {
        mostrarToast('Ingresa un correo electrónico válido', 'error');
        return;
    }
    if (password.length < 6) {
        mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    await apiRequest('/admin/estudiantes', {
        method: 'POST',
        body: JSON.stringify({
            matricula,
            nombre,
            email,
            password,
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
window.editarProfesor = editarProfesor;
window.editarEstudiante = editarEstudiante;
