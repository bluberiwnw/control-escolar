document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarActividades();
});

async function cargarActividades() {
    const actividades = await apiRequest('/admin/actividades');
    const container = document.getElementById('actividadesContainer');
    if (actividades.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No hay actividades registradas.</div>';
        return;
    }
    // Mostrar tabla con acciones
    let html = `<div class="asistencia-tabla">
        <table><thead><tr><th>ID</th><th>Título</th><th>Materia</th><th>Tipo</th><th>Fecha entrega</th><th>Valor</th><th>Acciones</th></tr></thead><tbody>`;
    actividades.forEach(a => {
        html += `<tr>
            <td>${a.id}</td>
            <td>${a.titulo}</td>
            <td>${a.materia_nombre}</td>
            <td>${a.tipo}</td>
            <td>${formatearFecha(a.fecha_entrega)}</td>
            <td>${a.valor}</td>
            <td>
                <button class="btn-small" onclick="editarActividad(${a.id})">Editar</button>
                <button class="btn-small btn-danger" onclick="eliminarActividad(${a.id})">Eliminar</button>
            </td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// Función para eliminar (ya existe, pero la mejoramos)
async function eliminarActividad(id) {
    if (confirm('¿Eliminar actividad permanentemente?')) {
        await apiRequest(`/admin/actividades/${id}`, { method: 'DELETE' });
        mostrarToast('Actividad eliminada', 'success');
        cargarActividades();
    }
}

// Función para editar (abre modal con datos)
async function editarActividad(id) {
    const actividad = await apiRequest(`/actividades/${id}`); // endpoint que devuelve una actividad (debes crearlo)
    // Llenar modal y mostrar
    document.getElementById('editActividadId').value = actividad.id;
    document.getElementById('editTitulo').value = actividad.titulo;
    document.getElementById('editDescripcion').value = actividad.descripcion;
    document.getElementById('editFechaEntrega').value = actividad.fecha_entrega.split('T')[0];
    document.getElementById('editTipo').value = actividad.tipo;
    document.getElementById('editValor').value = actividad.valor;
    document.getElementById('editModal').style.display = 'flex';
}

async function guardarEdicion() {
    const id = document.getElementById('editActividadId').value;
    const data = {
        titulo: document.getElementById('editTitulo').value,
        descripcion: document.getElementById('editDescripcion').value,
        fecha_entrega: document.getElementById('editFechaEntrega').value,
        tipo: document.getElementById('editTipo').value,
        valor: parseInt(document.getElementById('editValor').value)
    };
    await apiRequest(`/actividades/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    mostrarToast('Actividad actualizada', 'success');
    cerrarModal();
    cargarActividades();
}