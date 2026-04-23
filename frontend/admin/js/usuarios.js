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
        
        // Cache de usuarios para togglePassword
        const usuariosCache = JSON.parse(localStorage.getItem('usuariosCache') || '[]');
        const usuariosActualizados = usuariosCache.filter(u => u.tipo !== 'profesor');
        profesores.forEach(p => {
            usuariosActualizados.push({...p, tipo: 'profesor'});
        });
        localStorage.setItem('usuariosCache', JSON.stringify(usuariosActualizados));
        
        const container = document.getElementById('listaProfesores');
        if (profesores.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay profesores registrados.</div>';
            return;
        }
        container.innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Contraseña</th><th>Acciones</th></tr></thead><tbody>
            ${profesores
                .map(
                    (p) => `<tr>
                <td data-label="Nombre">${p.nombre}</td>
                <td data-label="Email">${p.email}</td>
                <td data-label="Rol">${p.rol}</td>
                <td data-label="Contraseña">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span id="pass-${p.id}" style="font-family: monospace; font-size: 0.85rem;">${p.password || 'N/A'}</span>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="togglePassword(${p.id})" style="padding: 4px 8px;">
                            <i class="fas fa-eye" id="eye-${p.id}"></i>
                        </button>
                    </div>
                </td>
                <td data-label="Acciones" class="table-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="editarProfesor(${p.id}, '${p.nombre.replace(/'/g, "\\'")}', '${p.email.replace(/'/g, "\\'")}')">Editar</button>
                    <button type="button" class="btn btn-warning btn-sm" onclick="cambiarContrasena(${p.id}, 'profesor')">Cambiar contraseña</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarUsuario(${p.id},'profesor')">Eliminar</button>
                </td>
            </tr>`
                )
                .join('')}
        </tbody></table></div>`;
    } catch (e) {
        document.getElementById('listaProfesores').innerHTML = '<p class="alert alert-error">Error al cargar profesores.</p>';
    }
}

async function cargarEstudiantes() {
    try {
        console.log('Cargando estudiantes...');
        const estudiantes = await apiRequest('/admin/usuarios?rol=alumno');
        console.log('Estudiantes cargados:', estudiantes.length);
        
        // Cache de usuarios para togglePassword
        const usuariosCache = JSON.parse(localStorage.getItem('usuariosCache') || '[]');
        const usuariosActualizados = usuariosCache.filter(u => u.tipo !== 'alumno');
        estudiantes.forEach(e => {
            usuariosActualizados.push({...e, tipo: 'alumno'});
        });
        localStorage.setItem('usuariosCache', JSON.stringify(usuariosActualizados));
        
        const container = document.getElementById('listaEstudiantes');
        if (!container) {
            console.error('Contenedor listaEstudiantes no encontrado');
            return;
        }
        
        if (estudiantes.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay estudiantes registrados.</div>';
            return;
        }
        container.innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Año</th><th>Email</th><th>Contraseña</th><th>Acciones</th></tr></thead><tbody>
            ${estudiantes
                .map(
                    (e) => `<tr>
                <td data-label="Nombre">${e.nombre}</td>
                <td data-label="Año">
                    <span class="badge badge-info">${e.anio || 'N/A'}</span>
                </td>
                <td data-label="Email">${e.email}</td>
                <td data-label="Contraseña">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span id="pass-${e.id}" style="font-family: monospace; font-size: 0.85rem;">${e.password || 'N/A'}</span>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="togglePassword(${e.id})" style="padding: 4px 8px;">
                            <i class="fas fa-eye" id="eye-${e.id}"></i>
                        </button>
                    </div>
                </td>
                <td data-label="Acciones" class="table-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="editarEstudiante(${e.id}, '${e.matricula.replace(/'/g, "\\'")}', '${e.nombre.replace(/'/g, "\\'")}', '${e.email.replace(/'/g, "\\'")}')">Editar</button>
                    <button type="button" class="btn btn-warning btn-sm" onclick="cambiarContrasena(${e.id}, 'alumno')">Cambiar contraseña</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarUsuario(${e.id},'alumno')">Eliminar</button>
                </td>
            </tr>`
                )
                .join('')}
        </tbody></table></div>`;
    } catch (error) {
        console.error('Error al cargar estudiantes:', error);
        const container = document.getElementById('listaEstudiantes');
        if (container) {
            container.innerHTML = '<p class="alert alert-error">No se pudieron cargar los estudiantes. Intenta recargar la página.</p>';
        }
        mostrarToast('Error al cargar estudiantes. Verifica tu conexión e intenta de nuevo.', 'error');
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
    document.getElementById('estAnio').value = '';
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
    const anio = document.getElementById('estAnio').value;
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
    if (!anio || anio < 1 || anio > 6) {
        mostrarToast('Selecciona un año válido (1-6)', 'error');
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
            anio: parseInt(anio),
            email,
            password,
        }),
    });
    mostrarToast('Estudiante creado', 'success');
    cerrarModalEstudiante();
    cargarEstudiantes();
}

function togglePassword(userId) {
    const passElement = document.getElementById(`pass-${userId}`);
    const eyeElement = document.getElementById(`eye-${userId}`);
    
    if (passElement.style.display === 'none' || passElement.textContent === '******') {
        // Mostrar contraseña
        const usuarios = JSON.parse(localStorage.getItem('usuariosCache') || '[]');
        const usuario = usuarios.find(u => u.id === userId);
        passElement.textContent = usuario ? usuario.password : 'N/A';
        passElement.style.display = 'inline';
        eyeElement.className = 'fas fa-eye-slash';
    } else {
        // Ocultar contraseña
        passElement.textContent = '******';
        eyeElement.className = 'fas fa-eye';
    }
}

async function cambiarContrasena(userId, tipo) {
    // Crear modal para cambiar contraseña
    const modal = document.createElement('div');
    modal.id = 'modalCambiarContrasena';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
            max-width: 480px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            animation: modalSlideIn 0.3s ease;
        ">
            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 24px 24px 16px;
                border-bottom: 1px solid #e2e8f0;
            ">
                <h3 style="
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #1a202c;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                "><i class="fas fa-key"></i> Cambiar Contraseña</h3>
                <button type="button" onclick="cerrarModalCambiarContrasena()" style="
                    background: transparent;
                    border: none;
                    font-size: 1.25rem;
                    color: #718096;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                "><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 16px 24px 24px;">
                <form onsubmit="handleCambiarContrasena(event, ${userId}, '${tipo}')">
                    <div style="margin-bottom: 18px;">
                        <label style="
                            display: block;
                            font-size: 0.85rem;
                            font-weight: 600;
                            color: #4a5568;
                            margin-bottom: 8px;
                        ">Nueva Contraseña</label>
                        <input type="password" id="nuevaContrasenaInput" required style="
                            width: 100%;
                            padding: 12px 16px;
                            font-size: 1rem;
                            border-radius: 12px;
                            border: 1px solid #e2e8f0;
                            background: #f7fafc;
                            color: #1a202c;
                        " placeholder="Mínimo 6 caracteres">
                    </div>
                    <div style="
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: flex-end;
                        gap: 12px;
                        margin-top: 24px;
                        padding-top: 16px;
                        border-top: 1px solid #e2e8f0;
                    ">
                        <button type="button" onclick="cerrarModalCambiarContrasena()" style="
                            padding: 10px 20px;
                            border-radius: 8px;
                            border: 1px solid #e2e8f0;
                            background: #f7fafc;
                            color: #4a5568;
                            font-weight: 600;
                            cursor: pointer;
                        ">Cancelar</button>
                        <button type="submit" style="
                            padding: 10px 20px;
                            border-radius: 8px;
                            border: none;
                            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                            color: white;
                            font-weight: 600;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        "><i class="fas fa-save"></i> Actualizar Contraseña</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('nuevaContrasenaInput').focus();
}

function cerrarModalCambiarContrasena() {
    const modal = document.getElementById('modalCambiarContrasena');
    if (modal) {
        modal.remove();
    }
}

async function handleCambiarContrasena(event, userId, tipo) {
    event.preventDefault();
    const nuevaContrasena = document.getElementById('nuevaContrasenaInput').value.trim();
    
    if (!nuevaContrasena) {
        mostrarToast('Por favor ingresa la nueva contraseña', 'error');
        return;
    }
    
    if (nuevaContrasena.length < 6) {
        mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    try {
        const response = await apiRequest(`/admin/usuarios/${userId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ password: nuevaContrasena }),
        });
        
        if (response && response.message) {
            mostrarToast(response.message, 'success');
        } else {
            mostrarToast('Contraseña actualizada exitosamente', 'success');
        }
        
        cerrarModalCambiarContrasena();
        
        // Actualizar cache de usuarios con nueva contraseña
        const usuariosCache = JSON.parse(localStorage.getItem('usuariosCache') || '[]');
        const usuarioIndex = usuariosCache.findIndex(u => u.id == userId);
        if (usuarioIndex !== -1) {
            usuariosCache[usuarioIndex].password = nuevaContrasena;
            localStorage.setItem('usuariosCache', JSON.stringify(usuariosCache));
        }
        
        // Actualizar contraseña en el DOM si está visible
        const passElement = document.getElementById(`pass-${userId}`);
        if (passElement) {
            passElement.textContent = nuevaContrasena;
        }
        
        // Recargar la lista para asegurar consistencia
        if (tipo === 'profesor') await cargarProfesores();
        else await cargarEstudiantes();
        
    } catch (error) {
        console.error('Error detallado:', error);
        mostrarToast('Error al actualizar contraseña: ' + (error.message || 'Intenta de nuevo'), 'error');
    }
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
window.togglePassword = togglePassword;
window.cambiarContrasena = cambiarContrasena;
window.cerrarModalCambiarContrasena = cerrarModalCambiarContrasena;
window.handleCambiarContrasena = handleCambiarContrasena;
