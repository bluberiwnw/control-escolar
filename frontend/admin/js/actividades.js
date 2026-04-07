document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const actividades = await apiRequest('/admin/actividades');
    document.getElementById('actividadesContainer').innerHTML = actividades.map(a => `
        <div class="actividad-card"><div class="actividad-titulo">${a.titulo}</div><div class="actividad-descripcion">${a.descripcion}</div><div class="actividad-meta">Materia: ${a.materia_nombre} | Entrega: ${formatearFecha(a.fecha_entrega)}</div><button onclick="eliminarActividad(${a.id})">Eliminar</button></div>
    `).join('');
});

async function eliminarActividad(id) {
    if (confirm('¿Eliminar actividad?')) {
        await apiRequest(`/admin/actividades/${id}`, { method: 'DELETE' });
        location.reload();
    }
}