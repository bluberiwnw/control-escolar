let actividadesAdmin = [];
let materiasAdmin = [];
let entregasAdmin = [];

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMateriasAdmin();
    await cargarActividades();
    await cargarArchivosEntregas();
});

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderResumen(actividades) {
    const total = actividades.length;
    const tareas = actividades.filter((a) => a.tipo === 'tarea').length;
    const proyectos = actividades.filter((a) => a.tipo === 'proyecto').length;
    const examenes = actividades.filter((a) => a.tipo === 'examen').length;
    document.getElementById('resumenActividadesAdmin').innerHTML = `
        <article class="kpi-card kpi-card--violet"><span class="kpi-card__label">Total</span><span class="kpi-card__value">${total}</span></article>
        <article class="kpi-card kpi-card--teal"><span class="kpi-card__label">Tareas</span><span class="kpi-card__value">${tareas}</span></article>
        <article class="kpi-card kpi-card--amber"><span class="kpi-card__label">Proyectos</span><span class="kpi-card__value">${proyectos}</span></article>
        <article class="kpi-card kpi-card--rose"><span class="kpi-card__label">Exámenes</span><span class="kpi-card__value">${examenes}</span></article>
    `;
}

function renderActividadesCards(actividades) {
    const container = document.getElementById('actividadesContainer');
    if (!actividades.length) {
        container.innerHTML = '<div class="empty-state">No hay actividades para los filtros seleccionados.</div>';
        return;
    }
    container.innerHTML = actividades
        .map(
            (a) => `<article class="activity-admin-card">
            <header class="activity-admin-card__head">
                <h3>${escapeHtml(a.titulo)}</h3>
                <span class="badge badge-${a.tipo === 'examen' ? 'danger' : a.tipo === 'proyecto' ? 'warning' : 'success'}">${escapeHtml(a.tipo)}</span>
            </header>
            <p class="activity-admin-card__desc">${escapeHtml(a.descripcion || 'Sin descripción.')}</p>
            <div class="activity-admin-card__meta">
                <span><i class="fas fa-book"></i> ${escapeHtml(a.materia_nombre)}</span>
                <span><i class="fas fa-calendar"></i> ${formatearFecha(a.fecha_entrega)}</span>
                <span><i class="fas fa-star"></i> ${a.valor} pts</span>
            </div>
            <div class="table-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="editarActividad(${a.id})">Editar</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="eliminarActividad(${a.id})">Eliminar</button>
            </div>
        </article>`
        )
        .join('');
}

function aplicarFiltrosActividades() {
    const materiaId = document.getElementById('filtroMateriaActividad').value;
    const tipo = document.getElementById('filtroTipoActividad').value;
    const q = document.getElementById('busquedaActividad').value.trim().toLowerCase();
    const filtradas = actividadesAdmin.filter((a) => {
        const matchMateria = !materiaId || String(a.materia_id) === materiaId;
        const matchTipo = !tipo || a.tipo === tipo;
        const texto = `${a.titulo || ''} ${a.descripcion || ''}`.toLowerCase();
        const matchTexto = !q || texto.includes(q);
        return matchMateria && matchTipo && matchTexto;
    });
    renderResumen(filtradas);
    renderActividadesCards(filtradas);
    cargarArchivosEntregas();
}

async function cargarMateriasAdmin() {
    materiasAdmin = await apiRequest('/admin/materias');
    const opciones = materiasAdmin.map((m) => `<option value="${m.id}">${escapeHtml(m.nombre)} (${escapeHtml(m.clave)})</option>`).join('');
    document.getElementById('editMateriaId').innerHTML = opciones;
    document.getElementById('filtroMateriaActividad').innerHTML = `<option value="">Todas las materias</option>${opciones}`;
}

async function cargarActividades() {
    actividadesAdmin = await apiRequest('/admin/actividades');
    aplicarFiltrosActividades();
}

function renderArchivosEntregas(entregas) {
    const container = document.getElementById('archivosEntregasContainer');
    if (!entregas.length) {
        container.innerHTML = '<div class="empty-state">No hay archivos de entregas para la materia seleccionada.</div>';
        return;
    }
    container.innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr>
        <th>Materia</th><th>Actividad</th><th>Estudiante</th><th>Archivo</th><th>Calif.</th><th>Comentario</th><th>Acciones</th>
    </tr></thead><tbody>
    ${entregas
        .map(
            (e) => `<tr>
        <td data-label="Materia">${escapeHtml(e.materia_nombre)}</td>
        <td data-label="Actividad">${escapeHtml(e.actividad_titulo)}</td>
        <td data-label="Estudiante">${escapeHtml(e.estudiante_nombre)}</td>
        <td data-label="Archivo">${escapeHtml(e.archivo || 'Sin archivo')}</td>
        <td data-label="Calificación">${e.calificacion != null && e.calificacion !== '' ? escapeHtml(String(e.calificacion)) : '—'}</td>
        <td data-label="Comentario">${escapeHtml(e.comentario || '—')}</td>
        <td data-label="Acciones" class="table-actions">
            ${e.archivo ? `<button type="button" class="btn btn-secondary btn-sm" data-auth-download="/admin/entregas/archivos/${e.id}/descarga">Descargar</button>` : ''}
            <button type="button" class="btn btn-secondary btn-sm" onclick="abrirModalEntregaArchivo(${e.id})">Modificar</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="eliminarEntregaArchivo(${e.id})">Eliminar</button>
        </td>
    </tr>`
        )
        .join('')}
    </tbody></table></div>`;
}

async function cargarArchivosEntregas() {
    const materiaId = document.getElementById('filtroMateriaActividad').value;
    const url = materiaId ? `/admin/entregas/archivos?materia_id=${encodeURIComponent(materiaId)}` : '/admin/entregas/archivos';
    entregasAdmin = await apiRequest(url);
    renderArchivosEntregas(entregasAdmin);
}

async function eliminarActividad(id) {
    if (!confirm('¿Eliminar esta actividad?')) return;
    await apiRequest(`/admin/actividades/${id}`, { method: 'DELETE' });
    mostrarToast('Actividad eliminada', 'success');
    await cargarActividades();
}

function abrirModalEntregaArchivo(id) {
    const entrega = entregasAdmin.find((e) => e.id === id);
    if (!entrega) return;
    document.getElementById('editEntregaId').value = String(entrega.id);
    document.getElementById('editEntregaComentario').value = entrega.comentario || '';
    const calEl = document.getElementById('editEntregaCalificacion');
    if (calEl) {
        calEl.value = entrega.calificacion != null && entrega.calificacion !== '' ? String(entrega.calificacion) : '';
    }
    document.getElementById('editEntregaArchivo').value = '';
    document.getElementById('modalEntregaArchivo').style.display = 'flex';
}

function cerrarModalEntregaArchivo() {
    document.getElementById('modalEntregaArchivo').style.display = 'none';
}

async function guardarEntregaArchivo(event) {
    event.preventDefault();
    const id = document.getElementById('editEntregaId').value;
    const comentario = document.getElementById('editEntregaComentario').value.trim();
    const calRaw = document.getElementById('editEntregaCalificacion')?.value?.trim() ?? '';
    const file = document.getElementById('editEntregaArchivo').files[0];
    if (!id) return;
    if (comentario.length > 500) {
        mostrarToast('El comentario no puede exceder 500 caracteres', 'error');
        return;
    }
    if (calRaw !== '') {
        const c = Number.parseFloat(calRaw);
        if (Number.isNaN(c) || c < 0 || c > 100) {
            mostrarToast('La calificación debe ser un número entre 0 y 100', 'error');
            return;
        }
    }
    const formData = new FormData();
    formData.append('comentario', comentario);
    formData.append('calificacion', calRaw);
    if (file) {
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        if (!['.pdf', '.doc', '.docx', '.zip'].includes(ext)) {
            mostrarToast('Formato no permitido (PDF, DOC, DOCX, ZIP)', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            mostrarToast('El archivo excede 10 MB', 'error');
            return;
        }
        formData.append('archivo', file);
    }
    const token = localStorage.getItem('token');
    const res = await fetch(`${window.API_URL}/admin/entregas/archivos/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    let data = {};
    try {
        data = await res.json();
    } catch (_) {
        data = {};
    }
    if (!res.ok) {
        mostrarToast(data.message || 'No se pudo actualizar la entrega', 'error');
        return;
    }
    mostrarToast('Archivo de entrega actualizado', 'success');
    cerrarModalEntregaArchivo();
    await cargarArchivosEntregas();
}

async function eliminarEntregaArchivo(id) {
    if (!confirm('¿Eliminar este archivo de entrega?')) return;
    await apiRequest(`/admin/entregas/archivos/${id}`, { method: 'DELETE' });
    mostrarToast('Archivo de entrega eliminado', 'success');
    await cargarArchivosEntregas();
}

function validarFormularioActividad(data) {
    if (!data.materia_id || Number.isNaN(data.materia_id)) return 'Selecciona una materia válida.';
    if (!['tarea', 'proyecto', 'examen'].includes(data.tipo)) return 'Selecciona un tipo válido.';
    if (data.titulo.length < 4 || data.titulo.length > 120) return 'El título debe tener entre 4 y 120 caracteres.';
    if (data.descripcion.length > 600) return 'La descripción no puede exceder 600 caracteres.';
    if (!data.fecha_entrega) return 'Selecciona una fecha de entrega.';
    if (data.valor < 1 || data.valor > 100) return 'El valor debe estar entre 1 y 100 puntos.';
    return null;
}

async function abrirModalNuevaActividad() {
    document.getElementById('tituloModalActividad').textContent = 'Nueva actividad';
    document.getElementById('editActividadId').value = '';
    document.getElementById('formActividad').reset();
    await cargarMateriasAdmin();
    document.getElementById('editFechaEntrega').valueAsDate = new Date();
    document.getElementById('editModal').style.display = 'flex';
}

async function editarActividad(id) {
    const actividad = await apiRequest(`/admin/actividades/${id}`);
    await cargarMateriasAdmin();
    document.getElementById('tituloModalActividad').textContent = 'Editar actividad';
    document.getElementById('editActividadId').value = actividad.id;
    document.getElementById('editMateriaId').value = actividad.materia_id;
    document.getElementById('editTitulo').value = actividad.titulo;
    document.getElementById('editDescripcion').value = actividad.descripcion || '';
    document.getElementById('editFechaEntrega').value = String(actividad.fecha_entrega).split('T')[0];
    document.getElementById('editTipo').value = actividad.tipo;
    document.getElementById('editValor').value = actividad.valor;
    document.getElementById('editModal').style.display = 'flex';
}

function cerrarModalActividad() {
    document.getElementById('editModal').style.display = 'none';
}

async function guardarActividadAdmin(ev) {
    ev.preventDefault();
    const id = document.getElementById('editActividadId').value;
    const data = {
        materia_id: Number.parseInt(document.getElementById('editMateriaId').value, 10),
        titulo: document.getElementById('editTitulo').value.trim(),
        descripcion: document.getElementById('editDescripcion').value.trim(),
        fecha_entrega: document.getElementById('editFechaEntrega').value,
        tipo: document.getElementById('editTipo').value,
        valor: Number.parseInt(document.getElementById('editValor').value, 10),
    };
    const error = validarFormularioActividad(data);
    if (error) {
        mostrarToast(error, 'error');
        return;
    }
    if (id) {
        await apiRequest(`/admin/actividades/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        mostrarToast('Actividad actualizada', 'success');
    } else {
        await apiRequest('/admin/actividades', { method: 'POST', body: JSON.stringify(data) });
        mostrarToast('Actividad creada', 'success');
    }
    cerrarModalActividad();
    await cargarActividades();
}

window.aplicarFiltrosActividades = aplicarFiltrosActividades;
window.abrirModalNuevaActividad = abrirModalNuevaActividad;
window.editarActividad = editarActividad;
window.eliminarActividad = eliminarActividad;
window.cerrarModalActividad = cerrarModalActividad;
window.guardarActividadAdmin = guardarActividadAdmin;
window.abrirModalEntregaArchivo = abrirModalEntregaArchivo;
window.cerrarModalEntregaArchivo = cerrarModalEntregaArchivo;
window.guardarEntregaArchivo = guardarEntregaArchivo;
window.eliminarEntregaArchivo = eliminarEntregaArchivo;
