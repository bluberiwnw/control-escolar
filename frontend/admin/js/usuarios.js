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
    try {
        console.log('Cargando administradores...');
        
        // Intentar cargar directamente primero
        let administradores = [];
        try {
            const lista = await apiRequest('/admin/usuarios?rol=admin');
            administradores = Array.isArray(lista) ? lista.filter((a) => a.rol === 'admin' || a.rol === 'administrador') : [];
            console.log('✅ Administradores cargados directamente:', administradores.length);
        } catch (error) {
            console.log('❌ Error cargando administradores directamente:', error.message);
            
            // Si falla, usar los datos guardados de profesores
            const todosLosUsuarios = JSON.parse(localStorage.getItem('todosLosUsuarios') || '[]');
            administradores = todosLosUsuarios.filter((a) => a.rol === 'admin' || a.rol === 'administrador');
            console.log('✅ Administradores extraidos de datos compartidos:', administradores.length);
        }
        
        // Cache de usuarios para togglePassword
        const usuariosCache = JSON.parse(localStorage.getItem('usuariosCache') || '[]');
        const usuariosActualizados = usuariosCache.filter(u => u.tipo !== 'administrador');
        administradores.forEach(a => {
            usuariosActualizados.push({...a, tipo: 'administrador'});
        });
        localStorage.setItem('usuariosCache', JSON.stringify(usuariosActualizados));
        
        const container = document.getElementById('listaAdministradores');
        if (administradores.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay administradores registrados.</div>';
            return;
        }
        container.innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Contraseña</th><th>Acciones</th></tr></thead><tbody>
            ${administradores
                .map(
                    (a) => `<tr>
                <td data-label="Nombre">${a.nombre}</td>
                <td data-label="Email">${a.email}</td>
                <td data-label="Rol">${a.rol || 'admin'}</td>
                <td data-label="Contraseña">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span id="pass-${a.id}" style="font-family: monospace; font-size: 0.85rem;">${a.password || 'N/A'}</span>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="togglePassword(${a.id})" style="padding: 4px 8px;">
                            <i class="fas fa-eye" id="eye-${a.id}"></i>
                        </button>
                    </div>
                </td>
                <td data-label="Acciones" class="table-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="editarAdministrador(${a.id}, '${a.nombre.replace(/'/g, "\\'")}', '${a.email.replace(/'/g, "\\'")}')">Editar</button>
                    <button type="button" class="btn btn-warning btn-sm" onclick="cambiarContrasena(${a.id}, 'administrador')">Cambiar contraseña</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarUsuario(${a.id},'administrador')">Eliminar</button>
                </td>
            </tr>`
                )
                .join('')}
        </tbody></table></div>`;
    } catch (error) {
        console.error('Error al cargar administradores:', error);
        const container = document.getElementById('listaAdministradores');
        if (container) {
            container.innerHTML = '<p class="alert alert-error">No se pudieron cargar los administradores. Intenta recargar la página.</p>';
        }
        mostrarToast('Error al cargar administradores. Verifica tu conexión e intenta de nuevo.', 'error');
    }
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
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    await apiRequest(`/admin/usuarios/${id}/${tipo}`, { method: 'DELETE' });
    mostrarToast('Usuario eliminado', 'success');
    if (tipo === 'profesor') cargarProfesores();
    else if (tipo === 'administrador') cargarAdministradores();
    else cargarEstudiantes();
}

// Funciones para administradores
function abrirModalAdministrador() {
    document.getElementById('modalAdministrador').style.display = 'flex';
    document.getElementById('adminNombre').value = '';
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminPass').value = '';
}

function cerrarModalAdministrador() {
    document.getElementById('modalAdministrador').style.display = 'none';
}

async function guardarAdministrador(ev) {
    ev.preventDefault();
    const nombre = document.getElementById('adminNombre').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPass').value;
    
    if (password.length < 6) {
        mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    try {
        console.log('Enviando datos del administrador:', { nombre, email, password });
        
        await apiRequest('/admin/usuarios', {
            method: 'POST',
            body: JSON.stringify({
                nombre,
                email,
                password,
                rol: 'admin',
            }),
        });
        
        mostrarToast('Administrador creado exitosamente', 'success');
        cerrarModalAdministrador();
        cargarAdministradores();
        
    } catch (error) {
        console.error('Error al crear administrador:', error);
        mostrarToast('Error al crear administrador: ' + (error.message || 'Intenta de nuevo'), 'error');
    }
}

async function editarAdministrador(id, nombreActual, emailActual) {
    const nuevoNombre = prompt('Nombre del administrador:', nombreActual);
    if (nuevoNombre === null) return;
    
    const nuevoEmail = prompt('Correo del administrador:', emailActual);
    if (nuevoEmail === null) return;
    
    try {
        console.log('Actualizando administrador:', {
            id, nombre: nuevoNombre.trim(), email: nuevoEmail.trim()
        });
        
        await apiRequest(`/admin/administradores/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ 
                nombre: nuevoNombre.trim(), 
                email: nuevoEmail.trim()
            }),
        });
        
        mostrarToast('Administrador actualizado exitosamente', 'success');
        cargarAdministradores();
        
    } catch (error) {
        console.error('Error al actualizar administrador:', error);
        mostrarToast('Error al actualizar administrador: ' + (error.message || 'Intenta de nuevo'), 'error');
    }
}

function togglePassword(userId) {
    const passElement = document.getElementById(`pass-${userId}`);
    const eyeElement = document.getElementById(`eye-${userId}`);
    
    if (!passElement || !eyeElement) return;
    
    if (passElement.textContent === '••••••••') {
        // Mostrar contraseña real
        const usuariosCache = JSON.parse(localStorage.getItem('usuariosCache') || '[]');
        const usuario = usuariosCache.find(u => u.id == userId);
        if (usuario && usuario.password) {
            passElement.textContent = usuario.password;
            eyeElement.className = 'fas fa-eye-slash';
        }
    } else {
        // Ocultar contraseña
        passElement.textContent = '••••••••';
        eyeElement.className = 'fas fa-eye';
    }
}

function cambiarContrasena(userId, tipo) {
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
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 32px;
            border-radius: 16px;
            max-width: 480px;
            width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        ">
            <h3 style="
                margin: 0 0 24px 0;
                font-size: 1.5rem;
                font-weight: 700;
                color: #1a202c;
            ">Cambiar Contraseña</h3>
            <form onsubmit="handleCambiarContrasena(event, ${userId}, '${tipo}')">
                <div style="margin-bottom: 20px;">
                    <label style="
                        display: block;
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
                    ">Actualizar Contraseña</button>
                </div>
            </form>
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
        await apiRequest(`/admin/usuarios/${userId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ password: nuevaContrasena }),
        });
        
        mostrarToast('Contraseña actualizada exitosamente', 'success');
        cerrarModalCambiarContrasena();
        
        // Recargar la lista para asegurar consistencia
        if (tipo === 'profesor') await cargarProfesores();
        else if (tipo === 'administrador') await cargarAdministradores();
        else await cargarEstudiantes();
        
    } catch (error) {
        console.error('Error al actualizar contraseña:', error);
        mostrarToast('Error al actualizar contraseña: ' + (error.message || 'Intenta de nuevo'), 'error');
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
