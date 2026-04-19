document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMateriasSelect();
    await cargarActividades();
    await cargarEntregasProfesor();
});

let actividadEditando = null;
let entregasProf = [];

function escapeHtmlEntrega(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function cargarActividades() {
    const actividades = await apiRequest('/actividades');
    const container = document.getElementById('actividadesContainer');
    if (!actividades.length) {
        container.innerHTML = '<div class="empty-state">No hay actividades registradas.</div>';
        return;
    }
    container.innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr>
        <th>Título</th><th>Materia</th><th>Tipo</th><th>Entrega</th><th>Valor</th><th>Acciones</th>
    </tr></thead><tbody>
    ${actividades
        .map(
            (a) => `<tr>
            <td data-label="Título">${a.titulo}</td>
            <td data-label="Materia">${a.materia_nombre}</td>
            <td data-label="Tipo">${a.tipo}</td>
            <td data-label="Entrega">${formatearFecha(a.fecha_entrega)}</td>
            <td data-label="Valor">${a.valor}</td>
            <td data-label="Acciones" class="table-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="mostrarModalActividad(${a.id})">Editar</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="eliminarActividad(${a.id})">Eliminar</button>
            </td>
        </tr>`
        )
        .join('')}
    </tbody></table></div>`;
}

async function cargarMateriasSelect() {
    const materias = await apiRequest('/materias');
    const opts = materias.map((m) => `<option value="${m.id}">${escapeHtmlEntrega(m.nombre)} (${escapeHtmlEntrega(m.clave)})</option>`).join('');
    document.getElementById('actividadMateria').innerHTML = opts;
    const filtro = document.getElementById('filtroMateriaEntregas');
    if (filtro) {
        filtro.innerHTML = `<option value="">Todas mis materias</option>${opts}`;
    }
}

async function cargarEntregasProfesor() {
    const mid = document.getElementById('filtroMateriaEntregas')?.value || '';
    const url = mid ? `/actividades/entregas?materia_id=${encodeURIComponent(mid)}` : '/actividades/entregas';
    try {
        entregasProf = await apiRequest(url);
    } catch (_) {
        entregasProf = [];
    }
    renderEntregasProfesor();
}

function renderEntregasProfesor() {
    const container = document.getElementById('entregasProfesorContainer');
    if (!container) return;
    if (!entregasProf.length) {
        container.innerHTML = '<div class="empty-state">No hay entregas para mostrar.</div>';
        return;
    }
    container.innerHTML = `<table class="data-table"><thead><tr>
        <th>Actividad</th><th>Materia</th><th>Estudiante</th><th>Archivo</th><th>Calif.</th><th>Comentario</th><th>Acciones</th>
    </tr></thead><tbody>
    ${entregasProf
        .map(
            (e) => `<tr>
            <td data-label="Actividad">${escapeHtmlEntrega(e.actividad_titulo)}</td>
            <td data-label="Materia">${escapeHtmlEntrega(e.materia_nombre)}</td>
            <td data-label="Estudiante">${escapeHtmlEntrega(e.estudiante_nombre)}</td>
            <td data-label="Archivo">${escapeHtmlEntrega(e.archivo || '—')}</td>
            <td data-label="Calificación">${e.calificacion != null && e.calificacion !== '' ? escapeHtmlEntrega(String(e.calificacion)) : '—'}</td>
            <td data-label="Comentario">${escapeHtmlEntrega(e.comentario || '—')}</td>
            <td data-label="Acciones" class="table-actions">
                ${e.archivo ? `<button type="button" class="btn btn-secondary btn-sm" onclick="descargarConAuth('/actividades/entregas/${e.id}/descarga', ${JSON.stringify(e.archivo)})">Descargar</button>` : ''}
                <button type="button" class="btn btn-primary btn-sm" onclick="abrirModalRetroEntrega(${e.id})">Calificar / comentar</button>
            </td>
        </tr>`
        )
        .join('')}
    </tbody></table>`;
}

function abrirModalRetroEntrega(id) {
    const entrega = entregasProf.find((x) => x.id === id);
    if (!entrega) return;
    document.getElementById('retroEntregaId').value = String(entrega.id);
    document.getElementById('retroComentario').value = entrega.comentario || '';
    const cal = document.getElementById('retroCalificacion');
    cal.value = entrega.calificacion != null && entrega.calificacion !== '' ? String(entrega.calificacion) : '';
    document.getElementById('modalRetroEntrega').style.display = 'flex';
}

function cerrarModalRetroEntrega() {
    document.getElementById('modalRetroEntrega').style.display = 'none';
}

async function guardarRetroEntrega(event) {
    event.preventDefault();
    const id = document.getElementById('retroEntregaId').value;
    const comentario = document.getElementById('retroComentario').value.trim();
    const calRaw = document.getElementById('retroCalificacion').value.trim();
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
    await apiRequest(`/actividades/entregas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ comentario, calificacion: calRaw }),
    });
    mostrarToast('Retroalimentación guardada', 'success');
    cerrarModalRetroEntrega();
    await cargarEntregasProfesor();
}

async function mostrarModalActividad(id = null) {
    actividadEditando = null;
    const modal = document.getElementById('actividadModal');
    const form = document.getElementById('actividadForm');
    if (id) {
        actividadEditando = await apiRequest(`/actividades/${id}`);
        document.getElementById('actividadTitulo').value = actividadEditando.titulo;
        document.getElementById('actividadDescripcion').value = actividadEditando.descripcion || '';
        document.getElementById('actividadFecha').value = String(actividadEditando.fecha_entrega).split('T')[0];
        document.getElementById('actividadTipo').value = actividadEditando.tipo;
        document.getElementById('actividadValor').value = actividadEditando.valor;
        document.getElementById('actividadMateria').value = actividadEditando.materia_id;
    } else {
        form.reset();
        document.getElementById('actividadFecha').valueAsDate = new Date();
    }
    modal.style.display = 'flex';
}

async function guardarActividad(event) {
    event.preventDefault();
    const titulo = document.getElementById('actividadTitulo').value.trim();
    const descripcion = document.getElementById('actividadDescripcion').value.trim();
    const fecha_entrega = document.getElementById('actividadFecha').value;
    const valor = parseInt(document.getElementById('actividadValor').value, 10);
    if (!titulo || !fecha_entrega || Number.isNaN(valor)) {
        mostrarToast('Completa todos los campos obligatorios', 'error');
        return;
    }
    if (titulo.length < 4 || titulo.length > 120) {
        mostrarToast('El título debe tener entre 4 y 120 caracteres', 'error');
        return;
    }
    if (descripcion.length > 600) {
        mostrarToast('La descripción no puede exceder 600 caracteres', 'error');
        return;
    }
    if (valor < 1 || valor > 100) {
        mostrarToast('El valor debe estar entre 1 y 100', 'error');
        return;
    }
    const data = {
        materia_id: parseInt(document.getElementById('actividadMateria').value),
        tipo: document.getElementById('actividadTipo').value,
        titulo,
        descripcion,
        fecha_entrega,
        valor,
    };
    if (actividadEditando) {
        await apiRequest(`/actividades/${actividadEditando.id}`, { method: 'PUT', body: JSON.stringify(data) });
        mostrarToast('Actividad actualizada', 'success');
    } else {
        await apiRequest('/actividades', { method: 'POST', body: JSON.stringify(data) });
        mostrarToast('Actividad creada', 'success');
    }
    cerrarModal();
    cargarActividades();
    cargarEntregasProfesor();
}

async function eliminarActividad(id) {
    if (!confirm('Eliminar esta actividad?')) return;
    await apiRequest(`/actividades/${id}`, { method: 'DELETE' });
    mostrarToast('Actividad eliminada', 'success');
    cargarActividades();
    cargarEntregasProfesor();
}

function cerrarModal() {
    document.getElementById('actividadModal').style.display = 'none';
    actividadEditando = null;
}

window.mostrarModalActividad = mostrarModalActividad;
window.guardarActividad = guardarActividad;
window.cerrarModal = cerrarModal;
window.eliminarActividad = eliminarActividad;
window.cargarEntregasProfesor = cargarEntregasProfesor;
window.abrirModalRetroEntrega = abrirModalRetroEntrega;
window.cerrarModalRetroEntrega = cerrarModalRetroEntrega;
window.guardarRetroEntrega = guardarRetroEntrega;