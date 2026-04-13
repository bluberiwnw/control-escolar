document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarActividades();
});

async function cargarSelectMaterias() {
    const materias = await apiRequest('/admin/materias');
    const sel = document.getElementById('editMateriaId');
    sel.innerHTML = materias.map((m) => `<option value="${m.id}">${m.nombre} (${m.clave})</option>`).join('');
}

async function cargarActividades() {
    const actividades = await apiRequest('/admin/actividades');
    const container = document.getElementById('actividadesContainer');
    if (actividades.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay actividades registradas.</div>';
        return;
    }
    let html = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr>
        <th>Título</th><th>Materia</th><th>Tipo</th><th>Entrega</th><th>Valor</th><th>Acciones</th>
    </tr></thead><tbody>`;
    actividades.forEach((a) => {
        html += `<tr>
            <td data-label="Título">${a.titulo}</td>
            <td data-label="Materia">${a.materia_nombre}</td>
            <td data-label="Tipo">${a.tipo}</td>
            <td data-label="Entrega">${formatearFecha(a.fecha_entrega)}</td>
            <td data-label="Valor">${a.valor}</td>
            <td data-label="Acciones" class="table-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="editarActividad(${a.id})">Editar</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="eliminarActividad(${a.id})">Eliminar</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function eliminarActividad(id) {
    if (!confirm('¿Eliminar esta actividad?')) return;
    await apiRequest(`/admin/actividades/${id}`, { method: 'DELETE' });
    mostrarToast('Actividad eliminada', 'success');
    cargarActividades();
}

async function abrirModalNuevaActividad() {
    document.getElementById('tituloModalActividad').textContent = 'Nueva actividad';
    document.getElementById('editActividadId').value = '';
    document.getElementById('formActividad').reset();
    await cargarSelectMaterias();
    document.getElementById('editModal').style.display = 'flex';
}

async function editarActividad(id) {
    const actividad = await apiRequest(`/admin/actividades/${id}`);
    await cargarSelectMaterias();
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
        materia_id: parseInt(document.getElementById('editMateriaId').value, 10),
        titulo: document.getElementById('editTitulo').value.trim(),
        descripcion: document.getElementById('editDescripcion').value.trim(),
        fecha_entrega: document.getElementById('editFechaEntrega').value,
        tipo: document.getElementById('editTipo').value,
        valor: parseInt(document.getElementById('editValor').value, 10) || 100,
    };
    if (id) {
        await apiRequest(`/admin/actividades/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                materia_id: data.materia_id,
                titulo: data.titulo,
                descripcion: data.descripcion,
                fecha_entrega: data.fecha_entrega,
                tipo: data.tipo,
                valor: data.valor,
            }),
        });
        mostrarToast('Actividad actualizada', 'success');
    } else {
        await apiRequest('/admin/actividades', { method: 'POST', body: JSON.stringify(data) });
        mostrarToast('Actividad creada', 'success');
    }
    cerrarModalActividad();
    cargarActividades();
}

window.abrirModalNuevaActividad = abrirModalNuevaActividad;
window.editarActividad = editarActividad;
window.eliminarActividad = eliminarActividad;
window.cerrarModalActividad = cerrarModalActividad;
window.guardarActividadAdmin = guardarActividadAdmin;
