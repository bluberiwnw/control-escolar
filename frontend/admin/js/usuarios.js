document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarProfesores();
    await cargarAdministradores();
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
        console.log('Cargando profesores...');
        const lista = await apiRequest('/admin/usuarios?rol=profesor');
        const profesores = Array.isArray(lista) ? lista.filter((p) => p.rol === 'profesor') : [];
        console.log('✅ Profesores cargados:', profesores.length);
        
        // También guardar todos los usuarios para uso compartido
        if (Array.isArray(lista) && lista.length > 0) {
            console.log('📦 Guardando todosLosUsuarios en localStorage:', lista.length, 'usuarios');
            lista.forEach((usuario, index) => {
                console.log(`  📝 Usuario ${index + 1} guardado:`, {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    email: usuario.email,
                    rol: usuario.rol,
                    role: usuario.role,
                    tipo: usuario.tipo
                });
            });
            localStorage.setItem('todosLosUsuarios', JSON.stringify(lista));
            console.log('✅ Datos guardados exitosamente');
        }
        
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

async function cargarAdministradores() {
    try {
        console.log('Cargando administradores...');
        
        // Usar el endpoint de profesores ya que es el único que funciona y contiene todos los usuarios
        let administradores = [];
        try {
            const lista = await apiRequest('/admin/usuarios?rol=profesor');
            administradores = Array.isArray(lista) ? lista.filter((a) => a.rol === 'admin' || a.rol === 'administrador') : [];
            console.log('✅ Administradores extraidos del endpoint de profesores:', administradores.length);
        } catch (error) {
            console.log('❌ Error cargando administradores:', error.message);
            
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
    try {
        console.log('Cargando estudiantes...');
        
        // Estrategia principal: usar datos guardados de profesores
        const todosLosUsuarios = JSON.parse(localStorage.getItem('todosLosUsuarios') || '[]');
        let estudiantes = [];
        
        console.log('🔍 Verificación inicial de localStorage:');
        console.log('  todosLosUsuarios crudo:', localStorage.getItem('todosLosUsuarios'));
        console.log('  todosLosUsuarios parseado:', todosLosUsuarios);
        
        if (todosLosUsuarios.length > 0) {
            console.log('🔄 Usando datos guardados de todosLosUsuarios:', todosLosUsuarios.length);
            console.log('📊 Análisis de usuarios totales:');
            todosLosUsuarios.forEach((usuario, index) => {
                console.log(`  Usuario ${index + 1}:`, {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    email: usuario.email,
                    rol: usuario.rol,
                    role: usuario.role,
                    tipo: usuario.tipo,
                    activo: usuario.activo
                });
            });
            
            // Análisis de roles únicos para identificar posibles estudiantes
            const rolesUnicos = [...new Set(todosLosUsuarios.map(u => u.rol))];
            console.log('🔍 Roles únicos encontrados:', rolesUnicos);
            
            estudiantes = todosLosUsuarios.filter(usuario => {
                // Búsqueda exhaustiva de estudiantes
                const esEstudianteDirecto = usuario.rol === 'alumno' || 
                                         usuario.role === 'alumno' || 
                                         usuario.tipo === 'alumno' ||
                                         usuario.rol === 'estudiante' ||
                                         usuario.role === 'estudiante' ||
                                         usuario.tipo === 'estudiante' ||
                                         usuario.rol === 'student' ||
                                         usuario.role === 'student' ||
                                         usuario.tipo === 'student';
                
                const noEsProfesorNiAdmin = usuario.rol !== 'profesor' && 
                                         usuario.role !== 'profesor' && 
                                         usuario.tipo !== 'profesor' &&
                                         usuario.rol !== 'admin' && 
                                         usuario.role !== 'admin' && 
                                         usuario.tipo !== 'admin' &&
                                         usuario.rol !== 'administrador' && 
                                         usuario.role !== 'administrador' && 
                                         usuario.tipo !== 'administrador';
                
                const resultadoFinal = esEstudianteDirecto || noEsProfesorNiAdmin;
                
                console.log(`  🔍 Análisis usuario ${usuario.nombre}:`, {
                    rol: usuario.rol,
                    esEstudianteDirecto: esEstudianteDirecto,
                    noEsProfesorNiAdmin: noEsProfesorNiAdmin,
                    resultadoFinal: resultadoFinal
                });
                
                return resultadoFinal;
            });
            console.log('✅ Estudiantes extraidos de datos guardados:', estudiantes.length);
        } else {
            console.log('⚠️ No hay datos guardados, intentando endpoint directo...');
            
            // Como último recurso, intentar cargar con el método que funciona para profesores
            try {
                const lista = await apiRequest('/admin/usuarios?rol=profesor');
                const todosUsuarios = Array.isArray(lista) ? lista : [];
                
                if (todosUsuarios.length > 6) {
                    console.log('✅ Usando endpoint de profesores para extraer estudiantes...');
                    estudiantes = todosUsuarios.filter(usuario => {
                        return usuario.rol === 'alumno' || 
                               usuario.role === 'alumno' || 
                               usuario.tipo === 'alumno' ||
                               usuario.rol === 'estudiante' ||
                               usuario.role === 'estudiante' ||
                               usuario.tipo === 'estudiante' ||
                               // También verificar si no es profesor ni administrador (asumir que es estudiante)
                               (usuario.rol !== 'profesor' && 
                                usuario.role !== 'profesor' && 
                                usuario.tipo !== 'profesor' &&
                                usuario.rol !== 'admin' && 
                                usuario.role !== 'admin' && 
                                usuario.tipo !== 'admin' &&
                                usuario.rol !== 'administrador' && 
                                usuario.role !== 'administrador' && 
                                usuario.tipo !== 'administrador')
                    });
                    console.log('✅ Estudiantes extraidos de endpoint de profesores:', estudiantes.length);
                } else {
                    console.log('❌ Endpoint de profesores no contiene todos los usuarios');
                }
            } catch (error) {
                console.log('❌ Error en endpoint de respaldo:', error.message);
            }
        }
        
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
            console.log('📊 Resumen de usuarios:', {
                total: todosLosUsuarios.length,
                profesores: todosLosUsuarios.filter(u => u.rol === 'profesor').length,
                administradores: todosLosUsuarios.filter(u => u.rol === 'admin' || u.rol === 'administrador').length,
                estudiantes: estudiantes.length
            });
            
            container.innerHTML = `
                <div class="empty-state">
                    <h3>🎓 No hay estudiantes registrados</h3>
                    <p>Actualmente solo hay profesores y administradores en el sistema.</p>
                    <p><strong>Total de usuarios:</strong> ${todosLosUsuarios.length}</p>
                    <ul style="text-align: left; max-width: 300px; margin: 0 auto;">
                        <li>Profesores: ${todosLosUsuarios.filter(u => u.rol === 'profesor').length}</li>
                        <li>Administradores: ${todosLosUsuarios.filter(u => u.rol === 'admin' || u.rol === 'administrador').length}</li>
                        <li>Estudiantes: 0</li>
                    </ul>
                    <p style="margin-top: 20px;">
                        <strong>Para agregar estudiantes:</strong> Usa el botón "Nuevo estudiante" arriba.
                    </p>
                </div>
            `;
            return;
        }
        container.innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Contraseña</th><th>Acciones</th></tr></thead><tbody>
            ${estudiantes
                .map(
                    (e) => `<tr>
                <td data-label="Nombre">${e.nombre}</td>
                <td data-label="Email">${e.email}</td>
                <td data-label="Rol">${e.rol || 'alumno'}</td>
                <td data-label="Contraseña">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span id="pass-${e.id}" style="font-family: monospace; font-size: 0.85rem;">${e.password || 'N/A'}</span>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="togglePassword(${e.id})" style="padding: 4px 8px;">
                            <i class="fas fa-eye" id="eye-${e.id}"></i>
                        </button>
                    </div>
                </td>
                <td data-label="Acciones" class="table-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="editarEstudiante(${e.id}, '${e.nombre.replace(/'/g, "\\'")}', '${e.email.replace(/'/g, "\\'")}')">Editar</button>
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
    else if (tipo === 'administrador') cargarAdministradores();
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

async function editarEstudiante(id, nombreActual, emailActual) {
    // Crear un formulario de edición simple
    const nuevoNombre = prompt('Nombre del estudiante:', nombreActual);
    if (nuevoNombre === null) return;
    
    const nuevoEmail = prompt('Correo del estudiante:', emailActual);
    if (nuevoEmail === null) return;
    
    // Validaciones
    if (!esNombreValido(nuevoNombre)) {
        mostrarToast('El nombre debe tener entre 3 y 120 caracteres', 'error');
        return;
    }
    if (!esCorreoValido(nuevoEmail)) {
        mostrarToast('Ingresa un correo electrónico válido', 'error');
        return;
    }
    
    try {
        console.log('Actualizando estudiante:', {
            id, nombre: nuevoNombre.trim(), email: nuevoEmail.trim()
        });
        
        await apiRequest(`/admin/estudiantes/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ 
                nombre: nuevoNombre.trim(), 
                email: nuevoEmail.trim()
            }),
        });
        
        mostrarToast('Estudiante actualizado exitosamente', 'success');
        cargarEstudiantes();
        
    } catch (error) {
        console.error('Error al actualizar estudiante:', error);
        
        if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
            if (error.message.includes('email')) {
                mostrarToast('El correo electrónico ya está registrado', 'error');
            } else {
                mostrarToast('El estudiante ya existe en el sistema', 'error');
            }
        } else if (error.message.includes('500')) {
            mostrarToast('Error del servidor al actualizar estudiante. Intenta de nuevo.', 'error');
        } else {
            mostrarToast('Error al actualizar estudiante: ' + (error.message || 'Intenta de nuevo'), 'error');
        }
    }
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
    document.getElementById('estNombre').value = '';
    document.getElementById('estEmail').value = '';
    document.getElementById('estPass').value = '';
}

function cerrarModalEstudiante() {
    document.getElementById('modalEstudiante').style.display = 'none';
}

async function guardarEstudiante(ev) {
    ev.preventDefault();
    
    // Obtener campos del formulario
    const nombre = document.getElementById('estNombre').value.trim();
    const email = document.getElementById('estEmail').value.trim();
    const password = document.getElementById('estPass').value;
    
    // Validaciones
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
    
    try {
        console.log('Enviando datos del estudiante:', { nombre, email, password });
        
        // Usar el endpoint correcto para crear estudiantes
        console.log(' Creando estudiante con endpoint correcto...');
        const response = await apiRequest('/admin/estudiantes', {
            method: 'POST',
            body: JSON.stringify({
                nombre,
                email,
                password
            }),
        });
        console.log(' Estudiante creado exitosamente:', response);
        
        // Actualizar localStorage para que el nuevo estudiante aparezca inmediatamente
        const todosLosUsuarios = JSON.parse(localStorage.getItem('todosLosUsuarios') || '[]');
        const nuevoEstudiante = {
            id: response.id || Date.now(),
            nombre,
            email,
            password,
            rol: 'alumno',
            activo: true,
            created_at: new Date().toISOString()
        };
        todosLosUsuarios.push(nuevoEstudiante);
        localStorage.setItem('todosLosUsuarios', JSON.stringify(todosLosUsuarios));
        console.log(' Estudiante agregado a localStorage:', nuevoEstudiante);
        
        mostrarToast('Estudiante creado exitosamente', 'success');
        cerrarModalEstudiante();
        cargarEstudiantes();
        
    } catch (error) {
        console.error('Error al crear estudiante:', error);
        
        // Manejo específico de errores comunes
        if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
            if (error.message.includes('email')) {
                mostrarToast('El correo electrónico ya está registrado', 'error');
            } else {
                mostrarToast('El estudiante ya existe en el sistema', 'error');
            }
        } else if (error.message.includes('500')) {
            mostrarToast('Error del servidor. Posiblemente falta tabla en la base de datos.', 'error');
        } else if (error.message.includes('400')) {
            mostrarToast('Datos inválidos. Verifica toda la información.', 'error');
        } else {
            mostrarToast('Error al crear estudiante: ' + (error.message || 'Intenta de nuevo'), 'error');
        }
    }
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
        
        if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
            if (error.message.includes('email')) {
                mostrarToast('El correo electrónico ya está registrado', 'error');
            } else {
                mostrarToast('El administrador ya existe en el sistema', 'error');
            }
        } else if (error.message.includes('500')) {
            mostrarToast('Error del servidor. Posiblemente falta tabla en la base de datos.', 'error');
        } else if (error.message.includes('400')) {
            mostrarToast('Datos inválidos. Verifica toda la información.', 'error');
        } else {
            mostrarToast('Error al crear administrador: ' + (error.message || 'Intenta de nuevo'), 'error');
        }
    }
}

async function editarAdministrador(id, nombreActual, emailActual) {
    const nuevoNombre = prompt('Nombre del administrador:', nombreActual);
    if (nuevoNombre === null) return;
    
    const nuevoEmail = prompt('Correo del administrador:', emailActual);
    if (nuevoEmail === null) return;
    
    if (!esNombreValido(nuevoNombre)) {
        mostrarToast('El nombre debe tener entre 3 y 120 caracteres', 'error');
        return;
    }
    if (!esCorreoValido(nuevoEmail)) {
        mostrarToast('Ingresa un correo electrónico válido', 'error');
        return;
    }
    
    try {
        console.log('Actualizando administrador:', {
            id, nombre: nuevoNombre.trim(), email: nuevoEmail.trim()
        });
        
        // No hay endpoint PUT para administradores, solo para profesores y estudiantes
        // Solo se puede cambiar la contraseña de administradores
        mostrarToast('Para administradores solo se puede cambiar la contraseña. Los datos de nombre y email no se pueden modificar.', 'warning');
        return;
        
        mostrarToast('Administrador actualizado exitosamente', 'success');
        cargarAdministradores();
        
    } catch (error) {
        console.error('Error al actualizar administrador:', error);
        
        if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
            if (error.message.includes('email')) {
                mostrarToast('El correo electrónico ya está registrado', 'error');
            } else {
                mostrarToast('El administrador ya existe en el sistema', 'error');
            }
        } else if (error.message.includes('500')) {
            mostrarToast('Error del servidor al actualizar administrador. Intenta de nuevo.', 'error');
        } else {
            mostrarToast('Error al actualizar administrador: ' + (error.message || 'Intenta de nuevo'), 'error');
        }
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
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    "><i class="fas fa-save"></i> Actualizar Contraseña</button>
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
        else if (tipo === 'administrador') await cargarAdministradores();
        else await cargarEstudiantes();
        
    } catch (error) {
        console.error('Error detallado:', error);
        mostrarToast('Error al actualizar contraseña: ' + (error.message || 'Intenta de nuevo'), 'error');
    }
}

// Exponer funciones globales
window.eliminarUsuario = eliminarUsuario;
window.editarProfesor = editarProfesor;
window.editarEstudiante = editarEstudiante;
window.editarAdministrador = editarAdministrador;
window.togglePassword = togglePassword;
window.cambiarContrasena = cambiarContrasena;
window.cerrarModalCambiarContrasena = cerrarModalCambiarContrasena;
window.handleCambiarContrasena = handleCambiarContrasena;
window.abrirModalAdministrador = abrirModalAdministrador;
window.cerrarModalAdministrador = cerrarModalAdministrador;
window.guardarAdministrador = guardarAdministrador;
window.abrirModalProfesor = abrirModalProfesor;
window.cerrarModalProfesor = cerrarModalProfesor;
window.guardarProfesor = guardarProfesor;
window.abrirModalEstudiante = abrirModalEstudiante;
window.cerrarModalEstudiante = cerrarModalEstudiante;
window.guardarEstudiante = guardarEstudiante;