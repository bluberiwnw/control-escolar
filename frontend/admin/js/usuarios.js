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
        console.log('Cargando profesores...');
        const lista = await apiRequest('/admin/usuarios?rol=profesor');
        const profesores = Array.isArray(lista) ? lista.filter((p) => p.rol === 'profesor') : [];
        console.log('✅ Profesores cargados:', profesores.length);
        
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
        console.log('API Base:', API_URL);
        
        // Intentar diferentes endpoints posibles
        let estudiantes = [];
        let endpointsIntentados = [];
        
        // Lista de endpoints a intentar en orden (estrategia mejorada)
        const endpoints = [
            { url: '/admin/usuarios?rol=profesor', method: 'GET' },                   // Cargar como profesores (funciona)
            { url: '/admin/usuarios?rol=alumno', method: 'GET' },                    // GET tradicional (da 500)
            { url: '/admin/usuarios?todos=true', method: 'GET' },                     // Todos los usuarios (da 400)
            { url: '/admin/usuarios', method: 'GET' },                                // General sin filtro (da 400)
            { url: '/admin/usuarios?all=true', method: 'GET' },                      // Intentar con all
            { url: '/admin/usuarios?sin_filtro=true', method: 'GET' },               // Sin filtro
            { url: '/usuarios', method: 'GET' },
            { url: '/alumnos', method: 'GET' },
            { url: '/estudiantes', method: 'GET' }
        ];
        
        for (let i = 0; i < endpoints.length; i++) {
            const endpoint = endpoints[i];
            try {
                const endpointUrl = typeof endpoint === 'object' ? endpoint.url : endpoint;
                console.log(`Intentando endpoint ${i + 1}: ${endpointUrl} (${endpoint.method || 'GET'})`);
                
                const requestOptions = {};
                if (endpoint.method === 'POST' && endpoint.body) {
                    requestOptions.method = 'POST';
                    requestOptions.body = JSON.stringify(endpoint.body);
                }
                
                const response = await apiRequest(endpointUrl, requestOptions);
                let usuarios = Array.isArray(response) ? response : [];
                let estudiantesEndpoint = [];
                endpointsIntentados.push(endpointUrl);
                
                // Lógica mejorada de filtrado para estudiantes
                if (endpointUrl.includes('rol=profesor')) {
                    // Si cargamos profesores, extraer estudiantes de los mismos datos (si vienen todos)
                    console.log(`Endpoint cargó profesores, verificando si contiene todos los usuarios...`);
                    if (usuarios.length > 6) { // Si hay más de 6, probablemente vienen todos los usuarios
                        console.log(`✅ Detectados ${usuarios.length} usuarios totales, extrayendo estudiantes...`);
                        estudiantesEndpoint = usuarios.filter(usuario => {
                            return usuario.rol === 'alumno' || 
                                   usuario.role === 'alumno' || 
                                   usuario.tipo === 'alumno' ||
                                   usuario.rol === 'estudiante' ||
                                   usuario.role === 'estudiante' ||
                                   usuario.tipo === 'estudiante' ||
                                   (usuario.rol !== 'profesor' && usuario.role !== 'profesor' && usuario.tipo !== 'profesor')
                        });
                        console.log(`✅ Estudiantes extraidos de datos de profesores:`, estudiantesEndpoint.length);
                    } else {
                        console.log(`❌ Solo se cargaron profesores (${usuarios.length}), sin estudiantes...`);
                        estudiantesEndpoint = [];
                    }
                } else if (endpointUrl.includes('rol=alumno') || endpointUrl.includes('role=alumno') || endpointUrl.includes('role=student')) {
                    // Si el endpoint ya filtra por alumno, usar directamente
                    estudiantesEndpoint = usuarios;
                    console.log(`✅ Estudiantes cargados desde ${endpointUrl}:`, estudiantesEndpoint.length);
                } else if ((endpointUrl === '/admin/usuarios' || endpointUrl === '/usuarios') && endpoint.method !== 'POST') {
                    // Si es endpoint general con GET, filtrar estudiantes con múltiples criterios
                    console.log(`Filtrando estudiantes de ${usuarios.length} usuarios totales`);
                    estudiantesEndpoint = usuarios.filter(usuario => {
                        // Verificar múltiples campos posibles para el rol de estudiante
                        return usuario.rol === 'alumno' || 
                               usuario.role === 'alumno' || 
                               usuario.tipo === 'alumno' ||
                               usuario.rol === 'estudiante' ||
                               usuario.role === 'estudiante' ||
                               usuario.tipo === 'estudiante' ||
                               // También verificar si no es profesor (asumir que es estudiante)
                               (usuario.rol !== 'profesor' && usuario.role !== 'profesor' && usuario.tipo !== 'profesor')
                    });
                    console.log(`✅ Estudiantes filtrados desde ${endpointUrl}:`, estudiantesEndpoint.length);
                    console.log('Muestra de estudiantes encontrados:', estudiantesEndpoint.slice(0, 2));
                } else if (endpoint.method === 'POST' && endpoint.body && (endpoint.body.rol === 'alumno' || endpoint.body.rol === 'estudiante')) {
                    // Si es POST con rol de estudiante, usar directamente
                    estudiantesEndpoint = usuarios;
                    console.log(`✅ Estudiantes cargados desde ${endpointUrl} (POST):`, estudiantesEndpoint.length);
                } else {
                    // Para otros endpoints específicos (alumnos, estudiantes)
                    estudiantesEndpoint = usuarios;
                    console.log(`✅ Estudiantes cargados desde ${endpointUrl}:`, estudiantesEndpoint.length);
                }
                
                console.log('Datos de ejemplo:', estudiantesEndpoint.slice(0, 2));
                
                // Si encontramos estudiantes, salimos del bucle
                if (estudiantesEndpoint && estudiantesEndpoint.length > 0) {
                    estudiantes = estudiantesEndpoint;
                    break;
                }
            } catch (error) {
                const endpointDisplay = typeof endpoint === 'object' ? endpoint.url : endpoint;
                console.log(`❌ Error en endpoint ${endpointDisplay}:`, error.message);
                console.log('Error completo:', error);
                
                // Verificar si es error 500 que podría contener datos de estudiantes
                const esError500 = error.message && (
                    error.message.includes('500') ||
                    error.message.includes('No se pudieron cargar los usuarios')
                );
                
                // Verificar si es el error específico de columna 'anio' o cualquier error de columna
                const esErrorAnio = error.message && (
                    error.message.includes('column "anio" does not exist') ||
                    error.message.includes('columna "anio" no existe') ||
                    error.message.includes('anio') && error.message.includes('does not exist')
                );
                
                const esErrorColumna = error.message && (
                    error.message.includes('column') && error.message.includes('does not exist') ||
                    error.message.includes('columna') && error.message.includes('no existe') ||
                    error.message.includes('42703') // PostgreSQL error code for undefined_column
                );
                
                const esErrorBaseDatos = error.message && (
                    error.message.includes('relation') && error.message.includes('does not exist') ||
                    error.message.includes('42P01') // PostgreSQL error code for undefined_table
                );
                
                const esErrorRol = error.message && (
                    error.message.includes('Rol no válido') ||
                    error.message.includes('rol no válido') ||
                    error.message.includes('400') && error.message.includes('rol')
                );
                
                const esErrorEndpoint = error.message && (
                    error.message.includes('Cannot GET') ||
                    error.message.includes('404') ||
                    error.message.includes('<!DOCTYPE html>')
                );
                
                // Si es error 500 por columna anio, intentar solución alternativa
                if (esError500 && error.message.includes('column "anio" does not exist')) {
                    console.log('🔄 Error 500 detectado por columna anio, intentando solución alternativa...');
                    
                    // Intentar usar el mismo método que funciona para profesores pero sin filtro
                    try {
                        console.log('🔄 Intentando cargar todos los usuarios como se hace para profesores...');
                        
                        // Intentar diferentes métodos para cargar todos los usuarios
                        const metodosAlternativos = [
                            '/admin/usuarios?todos=true',
                            '/admin/usuarios?all=true',
                            '/admin/usuarios?sin_filtro=true',
                            '/admin/usuarios?completo=true'
                        ];
                        
                        for (const metodo of metodosAlternativos) {
                            try {
                                console.log(`🔄 Intentando método alternativo: ${metodo}`);
                                const todosResponse = await apiRequest(metodo);
                                if (Array.isArray(todosResponse)) {
                                    const estudiantesEncontrados = todosResponse.filter(usuario => 
                                        usuario.rol === 'alumno' || 
                                        usuario.role === 'alumno' || 
                                        usuario.tipo === 'alumno' ||
                                        usuario.rol === 'estudiante' ||
                                        usuario.role === 'estudiante' ||
                                        (usuario.rol !== 'profesor' && usuario.role !== 'profesor' && usuario.tipo !== 'profesor')
                                    );
                                    if (estudiantesEncontrados.length > 0) {
                                        console.log(`✅ Estudiantes encontrados con método alternativo:`, estudiantesEncontrados.length);
                                        estudiantes = estudiantesEncontrados;
                                        endpointsIntentados.push(`${endpointDisplay} (éxito con ${metodo})`);
                                        break;
                                    }
                                }
                            } catch (errorMetodo) {
                                console.log(`❌ Método ${metodo} falló:`, errorMetodo.message);
                                continue;
                            }
                        }
                        
                        // Si encontramos estudiantes con algún método, salir del bucle principal
                        if (estudiantes.length > 0) {
                            break;
                        }
                        
                    } catch (errorAlt) {
                        console.log('❌ Todos los métodos alternativos fallaron:', errorAlt.message);
                    }
                }
                
                if (esErrorAnio || esErrorColumna || esErrorBaseDatos) {
                    console.log('⚠️ Error de base de datos detectado, continuando con siguiente endpoint...');
                    let tipoError = 'columna desconocida';
                    if (esErrorAnio) tipoError = 'anio';
                    else if (esErrorColumna) tipoError = 'columna';
                    else if (esErrorBaseDatos) tipoError = 'tabla';
                    
                    endpointsIntentados.push(`${endpoint} (error: ${tipoError} no existe)`);
                    
                    // Si es error de columna anio, mostrar advertencia pero continuar con otros endpoints
                    if (esErrorAnio) {
                        console.log('⚠️ Error de columna anio detectado, intentando otros endpoints...');
                        // No detener la búsqueda, continuar con siguiente endpoint
                        continue;
                    }
                } else if (esErrorRol) {
                    console.log('⚠️ Error de rol detectado, continuando con siguiente endpoint...');
                    endpointsIntentados.push(`${endpoint} (error: rol no válido)`);
                    // No romper el bucle, continuar con siguiente endpoint
                    continue;
                } else if (esErrorEndpoint) {
                    console.log('⚠️ Endpoint no existe, continuando con siguiente endpoint...');
                    endpointsIntentados.push(`${endpoint} (error: endpoint no existe)`);
                    // No romper el bucle, continuar con siguiente endpoint
                    continue;
                } else {
                    endpointsIntentados.push(`${endpoint} (error: ${error.message})`);
                    // No romper el bucle, continuar con siguiente endpoint
                    continue;
                }
                
                // Si es el último endpoint y no se encontraron estudiantes, mostrar mensaje simple
                if (i === endpoints.length - 1 && estudiantes.length === 0) {
                    console.log('No se encontraron estudiantes en ningún endpoint');
                    const container = document.getElementById('listaEstudiantes');
                    if (container) {
                        container.innerHTML = `
                            <div class="alert alert-warning">
                                <h3>⚠️ No se encontraron estudiantes</h3>
                                <p>No hay estudiantes registrados en la base de datos o no se pudieron cargar.</p>
                                <p><strong>Endpoints intentados:</strong></p>
                                <ul>${endpointsIntentados.map(e => `<li>${e}</li>`).join('')}</ul>
                                <div style="margin-top: 20px; text-align: center;">
                                    <button type="button" class="btn btn-primary" onclick="location.reload()">
                                        <i class="fas fa-sync"></i> Recargar página
                                    </button>
                                    <button type="button" class="btn btn-secondary" onclick="cargarEstudiantes()">
                                        <i class="fas fa-redo"></i> Reintentar
                                    </button>
                                </div>
                            </div>
                        `;
                    }
                }
            }
        }
        
        // Cache de usuarios para togglePassword
        const usuariosCache = JSON.parse(localStorage.getItem('usuariosCache') || '[]');
        const usuariosActualizados = usuariosCache.filter(u => u.tipo !== 'alumno');
        estudiantes.forEach(e => {
            usuariosActualizados.push({...e, tipo: 'alumno'});
        });
        localStorage.setItem('usuariosCache', JSON.stringify(usuariosActualizados));
        
        // Eliminado: ya no se usan estudiantes locales
        
        const container = document.getElementById('listaEstudiantes');
        if (!container) {
            console.error('Contenedor listaEstudiantes no encontrado');
            return;
        }
        
        if (estudiantes.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay estudiantes registrados.</div>';
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
        
        // Intentar diferentes endpoints para crear estudiante
        let estudianteCreado = false;
        const endpointsCrear = [
            '/admin/usuarios',            // Endpoint principal
            '/usuarios/crear',           // Endpoint de creación
            '/admin/estudiantes/crear',   // Endpoint específico
            '/estudiantes/crear'         // Endpoint general
        ];
        
        for (const endpoint of endpointsCrear) {
            try {
                console.log(`Intentando crear estudiante en: ${endpoint.url}`);
                await apiRequest(endpoint.url, {
                    method: endpoint.method,
                    body: endpoint.body ? JSON.stringify(endpoint.body) : null,
                });
                estudianteCreado = true;
                break;
            } catch (error) {
                console.log(`Error creando estudiante en ${endpoint}:`, error.message);
                continue;
            }
        }
        
        if (!estudianteCreado) {
            throw new Error('No se pudo crear el estudiante. El servidor no está disponible o los endpoints no existen.');
        }
        
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
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
            mostrarToast('Error: Tabla no encontrada en la base de datos. Contacta al administrador.', 'error');
        } else if (error.message.includes('column') && error.message.includes('does not exist')) {
            mostrarToast('Error: Columna faltante en la base de datos. Contacta al administrador.', 'error');
        } else {
            mostrarToast('Error al crear estudiante: ' + (error.message || 'Intenta de nuevo'), 'error');
        }
    }
}

// Función de validación para matrícula
function esMatriculaValida(matricula) {
    return /^[0-9]{8}$/.test(matricula);
}

// Función para obtener nombre de carrera
function getCarreraNombre(carrera) {
    const carreras = {
        'computacion': 'Ciencias de la Computación',
        'software': 'Ingeniería de Software',
        'datos': 'Ciencia de Datos',
        'ia': 'Inteligencia Artificial'
    };
    return carreras[carrera] || carrera || 'N/A';
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
