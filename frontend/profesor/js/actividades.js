document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarActividades();
});
async function cargarActividades() {
    const actividades = await apiRequest('/actividades');
    document.getElementById('actividadesContainer').innerHTML = actividades.map(a => `<div class="actividad-card"><h3>${a.titulo}</h3><p>${a.descripcion}</p><small>Entrega: ${formatearFecha(a.fecha_entrega)}</small><button onclick="eliminarActividad(${a.id})">Eliminar</button></div>`).join('');
}

let actividadEditando = null;

async function mostrarModalActividad(actividad = null) {
    actividadEditando = actividad;
    const modal = document.getElementById('actividadModal');
    const form = document.getElementById('actividadForm');
    if (actividad) {
        document.getElementById('actividadTitulo').value = actividad.titulo;
        document.getElementById('actividadDescripcion').value = actividad.descripcion;
        document.getElementById('actividadFecha').value = actividad.fecha_entrega.split('T')[0];
        document.getElementById('actividadTipo').value = actividad.tipo;
        document.getElementById('actividadValor').value = actividad.valor;
        document.getElementById('actividadMateria').value = actividad.materia_id;
    } else {
        form.reset();
        document.getElementById('actividadFecha').valueAsDate = new Date();
    }
    modal.style.display = 'flex';
}

async function guardarActividad() {
    const data = {
        materia_id: parseInt(document.getElementById('actividadMateria').value),
        tipo: document.getElementById('actividadTipo').value,
        titulo: document.getElementById('actividadTitulo').value,
        descripcion: document.getElementById('actividadDescripcion').value,
        fecha_entrega: document.getElementById('actividadFecha').value,
        valor: parseInt(document.getElementById('actividadValor').value)
    };
    if (actividadEditando) {
        await apiRequest(`/actividades/${actividadEditando.id}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
        await apiRequest('/actividades', { method: 'POST', body: JSON.stringify(data) });
    }
    cerrarModal();
    cargarActividades();
}

function cerrarModal() {
    document.getElementById('actividadModal').style.display = 'none';
    actividadEditando = null;
}