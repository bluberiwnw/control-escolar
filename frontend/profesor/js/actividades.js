document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMateriasSelect();
    await cargarActividades();
});

let actividadEditando = null;

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
    document.getElementById('actividadMateria').innerHTML = materias
        .map((m) => `<option value="${m.id}">${m.nombre} (${m.clave})</option>`)
        .join('');
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
        mostrarToast('Actividad actualizada', 'success');
    } else {
        await apiRequest('/actividades', { method: 'POST', body: JSON.stringify(data) });
        mostrarToast('Actividad creada', 'success');
    }
    cerrarModal();
    cargarActividades();
}

async function eliminarActividad(id) {
    if (!confirm('Eliminar esta actividad?')) return;
    await apiRequest(`/actividades/${id}`, { method: 'DELETE' });
    mostrarToast('Actividad eliminada', 'success');
    cargarActividades();
}

function cerrarModal() {
    document.getElementById('actividadModal').style.display = 'none';
    actividadEditando = null;
}

window.mostrarModalActividad = mostrarModalActividad;
window.guardarActividad = guardarActividad;
window.cerrarModal = cerrarModal;
window.eliminarActividad = eliminarActividad;