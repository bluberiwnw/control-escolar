let actividadSeleccionadaId = null;

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarActividades();
});

async function cargarActividades() {
    const actividades = await apiRequest('/alumno/actividades');
    document.getElementById('actividadesContainer').innerHTML = actividades.map(a => `
        <div class="actividad-card">
            <div class="actividad-tipo">${a.tipo.toUpperCase()}</div>
            <div class="actividad-titulo">${a.titulo}</div>
            <div class="actividad-descripcion">${a.descripcion}</div>
            <div class="actividad-meta"><span><i class="fas fa-calendar"></i> Entrega: ${formatearFecha(a.fecha_entrega)}</span><span><i class="fas fa-star"></i> Valor: ${a.valor} pts</span></div>
            ${a.entregado ? '<span class="badge" style="background:green;">Entregado</span>' : `<button class="btn-course" onclick="mostrarModalEntrega(${a.id})">Subir trabajo</button>`}
        </div>
    `).join('');
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
        alert('Entrega subida correctamente');
        cerrarModal();
        cargarActividades();
    } else {
        alert('Error al subir');
    }
});