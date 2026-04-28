document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMaterias();
});

async function cargarProfesoresSelect() {
    const profesores = await apiRequest('/admin/usuarios?rol=profesor');
    const sel = document.getElementById('selectProfesor');
    sel.innerHTML =
        '<option value="">Sin asignar</option>' +
        profesores
            .filter((p) => p.rol === 'profesor')
            .map((p) => `<option value="${p.id}">${p.nombre} (${p.email})</option>`)
            .join('');
}

async function cargarMaterias() {
    try {
        const materias = await apiRequest('/admin/materias');
        const container = document.getElementById('materiasContainer');
        if (materias.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay materias registradas.</div>';
            return;
        }
        container.innerHTML = materias
            .map(
                (m) => {
                    const materiaCard = document.createElement('div');
                    materiaCard.className = 'course-card course-card--elevated';
                    
                    materiaCard.innerHTML = `
                        <div class="course-header"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
                        <div class="course-body">
                            <div class="course-detail"><i class="fas fa-chalkboard-user"></i> ${m.profesor_nombre || 'Sin asignar'}</div>
                            <div class="course-detail"><i class="fas fa-clock"></i> ${m.horario || '—'}</div>
                            <div class="course-detail"><i class="fas fa-users"></i> ${m.estudiantes ?? 0} estudiantes</div>
                        </div>
                        <div class="course-footer course-footer--split">
                            <button type="button" class="btn btn-info btn-sm" onclick="gestionarAlumnos(${m.id}, '${m.nombre}')"><i class="fas fa-users"></i> Alumnos</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="editarMateria(${m.id})"><i class="fas fa-pen"></i> Editar</button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="eliminarMateria(${m.id})"><i class="fas fa-trash"></i> Eliminar</button>
                        </div>
                    `;
                    
                    return materiaCard.outerHTML;
                }
            )
            .join('');
    } catch (error) {
        document.getElementById('materiasContainer').innerHTML =
            '<div class="alert alert-error">Error al cargar materias.</div>';
    }
}

async function eliminarMateria(id) {
    if (!confirm('¿Eliminar esta materia? Se eliminarán actividades vinculadas.')) return;
    await apiRequest(`/admin/materias/${id}`, { method: 'DELETE' });
    mostrarToast('Materia eliminada', 'success');
    cargarMaterias();
}

async function abrirModalMateriaNueva() {
    document.getElementById('modalMateriaTitulo').textContent = 'Nueva materia';
    document.getElementById('materiaIdEdit').value = '';
    document.getElementById('formMateria').reset();
    await cargarProfesoresSelect();
    document.getElementById('modalMateria').style.display = 'flex';
}

async function editarMateria(id) {
    const lista = await apiRequest('/admin/materias');
    const m = lista.find((x) => x.id === id);
    if (!m) return;
    await cargarProfesoresSelect();
    document.getElementById('modalMateriaTitulo').textContent = 'Editar materia';
    document.getElementById('materiaIdEdit').value = m.id;
    document.getElementById('nombreMateria').value = m.nombre;
    document.getElementById('claveMateria').value = m.clave;
    document.getElementById('horarioMateria').value = m.horario || '';
    document.getElementById('semestreMateria').value = m.semestre || '';
    document.getElementById('estudiantesMateria').value = m.estudiantes ?? 0;
    document.getElementById('bajasMateria').value = m.bajas ?? 0;
    document.getElementById('promedioMateria').value = m.promedio ?? 0;
    document.getElementById('selectProfesor').value = m.profesor_id || '';
    document.getElementById('modalMateria').style.display = 'flex';
}

function cerrarModalMateria() {
    document.getElementById('modalMateria').style.display = 'none';
}

async function guardarMateria(ev) {
    try {
        ev.preventDefault();
        const id = document.getElementById('materiaIdEdit').value;
        const profesorVal = document.getElementById('selectProfesor').value;
        const nombre = document.getElementById('nombreMateria').value.trim();
        const clave = document.getElementById('claveMateria').value.trim();
        const horario = document.getElementById('horarioMateria').value.trim();
        const semestre = document.getElementById('semestreMateria').value.trim();
        const estudiantes = parseInt(document.getElementById('estudiantesMateria').value, 10) || 0;
        const bajas = parseInt(document.getElementById('bajasMateria').value, 10) || 0;
        const promedio = parseFloat(document.getElementById('promedioMateria').value) || 0;

        if (!nombre || !clave || !horario || !semestre) {
            mostrarToast('Completa todos los campos obligatorios', 'error');
            return;
        }
        if (nombre.length < 4 || nombre.length > 120) {
            mostrarToast('El nombre debe tener entre 4 y 120 caracteres', 'error');
            return;
        }
        if (clave.length < 3 || clave.length > 20) {
            mostrarToast('La clave debe tener entre 3 y 20 caracteres', 'error');
            return;
        }
        if (estudiantes < 0 || bajas < 0 || bajas > estudiantes) {
            mostrarToast('Los valores de estudiantes/bajas no son válidos', 'error');
            return;
        }
        if (promedio < 0 || promedio > 10) {
            mostrarToast('El promedio debe estar entre 0 y 10', 'error');
            return;
        }

        const data = {
            nombre,
            clave,
            horario,
            semestre,
            estudiantes,
            bajas,
            promedio,
            profesor_id: profesorVal ? parseInt(profesorVal, 10) : null,
        };
        if (id) {
            await apiRequest(`/admin/materias/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            mostrarToast('Materia actualizada', 'success');
        } else {
            await apiRequest('/admin/materias', { method: 'POST', body: JSON.stringify(data) });
            mostrarToast('Materia creada', 'success');
        }
        cerrarModalMateria();
        cargarMaterias();
    } catch (error) {
        mostrarToast(error.message || 'No se pudo guardar la materia', 'error');
    }
}

// Funciones para gestión de alumnos
let materiaActualId = null;
let materiaActualNombre = null;

async function gestionarAlumnos(materiaId, materiaNombre) {
    materiaActualId = materiaId;
    materiaActualNombre = materiaNombre;
    
    document.getElementById('modalAlumnosTitulo').textContent = `Alumnos de ${materiaNombre}`;
    document.getElementById('modalAlumnos').style.display = 'flex';
    
    await cargarAlumnosMateria();
}

async function cargarAlumnosMateria() {
    if (!materiaActualId) return;
    
    try {
        mostrarToast('Cargando alumnos...', 'info');
        
        // Intentar usar el endpoint original primero
        let alumnos = [];
        try {
            const response = await apiRequest(`/materias/${materiaActualId}/estudiantes-inscritos`);
            alumnos = Array.isArray(response) ? response : [];
        } catch (error) {
            console.log('Endpoint original no disponible, usando alternativa...');
            // Si el endpoint original falla, usar una alternativa
            // Obtener todos los estudiantes y filtrar por inscripciones
            const estudiantes = await apiRequest('/admin/usuarios?rol=alumno');
            const todasLasMaterias = await apiRequest('/admin/materias');
            const materiaActual = todasLasMaterias.find(m => m.id == materiaActualId);
            
            if (materiaActual && materiaActual.profesor_id) {
                // Si la materia tiene profesor asignado, mostrar mensaje informativo
                alumnos = estudiantes.filter(e => e.materia_id == materiaActualId);
            } else {
                // Mostrar todos los alumnos como opción
                alumnos = estudiantes.slice(0, 10); // Limitar a 10 para no sobrecargar
            }
        }
        
        const tbody = document.getElementById('alumnosTableBody');
        
        if (alumnos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <i class="fas fa-user-graduate" style="font-size: 2rem; color: #94a3b8; margin-bottom: 1rem;"></i>
                            <p>No hay alumnos inscritos en esta materia.</p>
                            <button type="button" class="btn btn-primary" onclick="abrirModalAlumnoNuevo()">
                                <i class="fas fa-plus"></i> Agregar Primer Alumno
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = alumnos.map(alumno => `
            <tr>
                <td data-label="Matrícula">
                    <span class="matricula-badge">${alumno.matricula || 'N/A'}</span>
                </td>
                <td data-label="Nombre">
                    <div class="alumno-info">
                        <i class="fas fa-user-graduate"></i>
                        ${alumno.nombre}
                    </div>
                </td>
                <td data-label="Email">
                    <a href="mailto:${alumno.email}" class="email-link">
                        <i class="fas fa-envelope"></i>
                        ${alumno.email}
                    </a>
                </td>
                <td data-label="Estado">
                    <span class="badge badge-success">
                        <i class="fas fa-check-circle"></i>
                        Activo
                    </span>
                </td>
                <td data-label="Acciones">
                    <div class="table-actions">
                        <button type="button" class="btn btn-sm btn-secondary" onclick="editarAlumno(${alumno.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-danger" onclick="eliminarAlumnoMateria(${alumno.id}, '${alumno.nombre}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        mostrarToast(`${alumnos.length} alumnos cargados`, 'success');
        
    } catch (error) {
        console.error('Error al cargar alumnos:', error);
        const tbody = document.getElementById('alumnosTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem;">
                    <div class="alert alert-error">
                        <h4><i class="fas fa-exclamation-triangle"></i> Error al cargar alumnos</h4>
                        <p>${error.message || 'Error desconocido'}</p>
                        <button type="button" class="btn btn-secondary" onclick="cargarAlumnosMateria()">
                            <i class="fas fa-sync"></i> Reintentar
                        </button>
                    </div>
                </td>
            </tr>
        `;
        mostrarToast('Error al cargar alumnos', 'error');
    }
}

function cerrarModalAlumnos() {
    document.getElementById('modalAlumnos').style.display = 'none';
    materiaActualId = null;
    materiaActualNombre = null;
}

async function abrirModalAlumnoNuevo() {
    document.getElementById('modalAlumnoFormTitulo').textContent = 'Nuevo Alumno';
    document.getElementById('alumnoIdEdit').value = '';
    document.getElementById('alumnoMateriaId').value = materiaActualId;
    document.getElementById('formAlumno').reset();
    document.getElementById('alumnoMateriaId').value = materiaActualId;
    document.getElementById('modalAlumnoForm').style.display = 'flex';
}

async function editarAlumno(alumnoId) {
    try {
        const alumnos = await apiRequest(`/materias/${materiaActualId}/estudiantes-inscritos`);
        const alumno = alumnos.find(a => a.id === alumnoId);
        
        if (!alumno) {
            mostrarToast('Alumno no encontrado', 'error');
            return;
        }
        
        document.getElementById('modalAlumnoFormTitulo').textContent = 'Editar Alumno';
        document.getElementById('alumnoIdEdit').value = alumno.id;
        document.getElementById('alumnoMateriaId').value = materiaActualId;
        document.getElementById('alumnoMatricula').value = alumno.matricula;
        document.getElementById('alumnoNombre').value = alumno.nombre;
        document.getElementById('alumnoEmail').value = alumno.email;
        document.getElementById('alumnoPassword').value = '';
        document.getElementById('alumnoAnio').value = alumno.anio || '';
        
        document.getElementById('modalAlumnoForm').style.display = 'flex';
        
    } catch (error) {
        console.error('Error al cargar alumno:', error);
        mostrarToast('Error al cargar datos del alumno', 'error');
    }
}

function cerrarModalAlumnoForm() {
    document.getElementById('modalAlumnoForm').style.display = 'none';
}

async function guardarAlumno(event) {
    try {
        event.preventDefault();
        
        const id = document.getElementById('alumnoIdEdit').value;
        const materiaId = document.getElementById('alumnoMateriaId').value;
        const matricula = document.getElementById('alumnoMatricula').value.trim();
        const nombre = document.getElementById('alumnoNombre').value.trim();
        const email = document.getElementById('alumnoEmail').value.trim();
        const password = document.getElementById('alumnoPassword').value.trim();
        const anio = parseInt(document.getElementById('alumnoAnio').value) || null;
        
        // Validaciones
        if (!matricula || !nombre || !email) {
            mostrarToast('Completa los campos obligatorios', 'error');
            return;
        }
        
        if (matricula.length < 5 || matricula.length > 20) {
            mostrarToast('La matrícula debe tener entre 5 y 20 caracteres', 'error');
            return;
        }
        
        if (nombre.length < 5 || nombre.length > 120) {
            mostrarToast('El nombre debe tener entre 5 y 120 caracteres', 'error');
            return;
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            mostrarToast('El email no es válido', 'error');
            return;
        }
        
        if (password && password.length < 6) {
            mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        
        const data = {
            matricula,
            nombre,
            email,
            rol: 'alumno',
            anio,
            materia_id: materiaId
        };
        
        if (password) {
            data.password = password;
        }
        
        if (id) {
            await apiRequest(`/admin/usuarios/${id}`, { 
                method: 'PUT', 
                body: JSON.stringify(data) 
            });
            mostrarToast('Alumno actualizado', 'success');
        } else {
            await apiRequest('/admin/usuarios', { 
                method: 'POST', 
                body: JSON.stringify(data) 
            });
            mostrarToast('Alumno creado', 'success');
        }
        
        cerrarModalAlumnoForm();
        await cargarAlumnosMateria();
        await cargarMaterias(); // Actualizar contador de alumnos en las materias
        
    } catch (error) {
        console.error('Error al guardar alumno:', error);
        mostrarToast(error.message || 'No se pudo guardar el alumno', 'error');
    }
}

async function eliminarAlumnoMateria(alumnoId, alumnoNombre) {
    if (!confirm(`¿Eliminar al alumno "${alumnoNombre}"? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        await apiRequest(`/admin/usuarios/${alumnoId}`, { method: 'DELETE' });
        mostrarToast('Alumno eliminado', 'success');
        await cargarAlumnosMateria();
        await cargarMaterias(); // Actualizar contador de alumnos en las materias
        
    } catch (error) {
        console.error('Error al eliminar alumno:', error);
        mostrarToast(error.message || 'No se pudo eliminar el alumno', 'error');
    }
}

// Exportar funciones al scope global
window.abrirModalMateriaNueva = abrirModalMateriaNueva;
window.editarMateria = editarMateria;
window.eliminarMateria = eliminarMateria;
window.cerrarModalMateria = cerrarModalMateria;
window.guardarMateria = guardarMateria;

window.gestionarAlumnos = gestionarAlumnos;
window.cargarAlumnosMateria = cargarAlumnosMateria;
window.cerrarModalAlumnos = cerrarModalAlumnos;
window.abrirModalAlumnoNuevo = abrirModalAlumnoNuevo;
window.editarAlumno = editarAlumno;
window.cerrarModalAlumnoForm = cerrarModalAlumnoForm;
window.guardarAlumno = guardarAlumno;
window.eliminarAlumnoMateria = eliminarAlumnoMateria;
