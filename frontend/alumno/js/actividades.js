let actividadSeleccionadaId = null;

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarActividades();
});

async function cargarActividades() {
    const actividades = await apiRequest('/alumno/actividades');
    const hoy = new Date().toISOString().split('T')[0];
    const container = document.getElementById('actividadesContainer');
    if (!actividades.length) {
        container.innerHTML = '<div class="alert alert-info">No hay actividades disponibles.</div>';
        return;
    }
    let html = '';
    for (const a of actividades) {
        const fechaEntrega = a.fecha_entrega.split('T')[0];
        const puedeCancelar = a.entregado && fechaEntrega >= hoy;
        html += `
            <div class="actividad-card">
                <div class="actividad-tipo">${a.tipo.toUpperCase()}</div>
                <div class="actividad-titulo">${a.titulo}</div>
                <div class="actividad-descripcion">${a.descripcion || ''}</div>
                <div class="actividad-meta">
                    <span><i class="fas fa-calendar"></i> Entrega: ${formatearFecha(a.fecha_entrega)}</span>
                    <span><i class="fas fa-star"></i> Valor: ${a.valor} pts</span>
                </div>
                <div class="actividad-actions">
                    ${!a.entregado ? `<button type="button" class="btn btn-primary btn-sm" onclick="mostrarModalEntrega(${a.id})">Subir trabajo</button>` : ''}
                    ${a.entregado ? `<span class="badge badge-success">Entregado</span>` : ''}
                    ${a.entregado && a.archivo_entrega ? `<button type="button" class="btn btn-secondary btn-sm" data-auth-download="/alumno/entregas/actividad/${a.id}/descarga">Descargar archivo entregado</button>` : ''}
                    ${a.calificacion_entrega != null && a.calificacion_entrega !== '' ? `<span class="badge badge-info">Calificación: ${a.calificacion_entrega}</span>` : ''}
                    ${puedeCancelar ? `<button type="button" class="btn btn-danger btn-sm" onclick="cancelarEntrega(${a.id})">Cancelar entrega</button>` : ''}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function cancelarEntrega(actividadId) {
    if (!confirm('¿Cancelar la entrega? Podrás subir un nuevo archivo.')) return;
    await apiRequest(`/alumno/entregas/${actividadId}`, { method: 'DELETE' });
    mostrarToast('Entrega cancelada correctamente', 'success');
    cargarActividades(); // recargar lista
}

function mostrarModalEntrega(actividadId) {
    actividadSeleccionadaId = actividadId;
    document.getElementById('modalEntrega').style.display = 'flex';
}

async function cerrarModal() {
    document.getElementById('modalEntrega').style.display = 'none';
    document.getElementById('formEntrega').reset();
}

document.getElementById('formEntrega').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!actividadSeleccionadaId) {
        mostrarToast('Selecciona una actividad para entregar', 'error');
        return;
    }
    const fileInput = document.querySelector('input[name="archivo"]');
    const comentario = document.querySelector('textarea[name="comentario"]').value.trim();
    const file = fileInput.files[0];
    if (!file) {
        mostrarToast('Debes seleccionar un archivo', 'error');
        return;
    }
    const allowed = ['.pdf', '.doc', '.docx', '.zip'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) {
        mostrarToast('Formato no permitido (PDF, DOC, DOCX, ZIP)', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        mostrarToast('El archivo excede 10 MB', 'error');
        return;
    }
    if (comentario.length > 500) {
        mostrarToast('El comentario no puede exceder 500 caracteres', 'error');
        return;
    }
    const formData = new FormData();
    formData.append('actividad_id', actividadSeleccionadaId);
    formData.append('archivo', file);
    formData.append('comentario', comentario);
    const token = localStorage.getItem('token');
    const res = await fetch(`${window.API_URL}/alumno/entregas`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    let data = {};
    try {
        data = await res.json();
    } catch (_) {
        data = {};
    }
    if (res.ok) {
        mostrarToast('Entrega subida correctamente', 'success');
        cerrarModal();
        cargarActividades();
    } else {
        mostrarToast(data.error || data.message || 'Error al subir', 'error');
    }
});

window.cerrarModal = cerrarModal;
window.mostrarModalEntrega = mostrarModalEntrega;
window.cancelarEntrega = cancelarEntrega;