document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarActividades();
});
async function cargarActividades() {
    const actividades = await apiRequest('/actividades');
    document.getElementById('actividadesContainer').innerHTML = actividades.map(a => `<div class="actividad-card"><h3>${a.titulo}</h3><p>${a.descripcion}</p><small>Entrega: ${formatearFecha(a.fecha_entrega)}</small><button onclick="eliminarActividad(${a.id})">Eliminar</button></div>`).join('');
}