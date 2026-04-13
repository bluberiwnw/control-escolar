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
    const formData = new FormData();
    formData.append('actividad_id', actividadSeleccionadaId);
    formData.append('archivo', document.querySelector('input[name="archivo"]').files[0]);
    formData.append('comentario', document.querySelector('textarea[name="comentario"]').value);
    const token = localStorage.getItem('token');
    const res = await fetch(`${window.API_URL}/alumno/entregas`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    if (res.ok) {
        mostrarToast('Entrega subida correctamente', 'success');
        cerrarModal();
        cargarActividades();
    } else {
        mostrarToast('Error al subir', 'error');
    }
});

window.cerrarModal = cerrarModal;
window.mostrarModalEntrega = mostrarModalEntrega;
window.cancelarEntrega = cancelarEntrega;