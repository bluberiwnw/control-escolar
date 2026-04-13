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
                (m) => `
            <div class="course-card course-card--elevated">
                <div class="course-header"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
                <div class="course-body">
                    <div class="course-detail"><i class="fas fa-chalkboard-user"></i> ${m.profesor_nombre || 'Sin asignar'}</div>
                    <div class="course-detail"><i class="fas fa-clock"></i> ${m.horario || '—'}</div>
                    <div class="course-detail"><i class="fas fa-users"></i> ${m.estudiantes ?? 0} estudiantes</div>
                </div>
                <div class="course-footer course-footer--split">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="editarMateria(${m.id})"><i class="fas fa-pen"></i> Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarMateria(${m.id})"><i class="fas fa-trash"></i> Eliminar</button>
                </div>
            </div>`
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

window.abrirModalMateriaNueva = abrirModalMateriaNueva;
window.editarMateria = editarMateria;
window.eliminarMateria = eliminarMateria;
window.cerrarModalMateria = cerrarModalMateria;
window.guardarMateria = guardarMateria;
