document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarMaterias();
    await cargarCalificaciones();
});

async function cargarMaterias() {
    const materias = await apiRequest('/admin/materias');
    const select = document.getElementById('materiaSelect');
    select.innerHTML = '<option value="">Todas las materias</option>' + materias.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

async function cargarCalificaciones() {
    const materiaId = document.getElementById('materiaSelect').value;
    let url = '/admin/calificaciones';
    if (materiaId) url += `?materia_id=${materiaId}`;
    const calificaciones = await apiRequest(url);
    document.getElementById('calificacionesContainer').innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Estudiante</th><th>Actividad</th><th>Calificación</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>
        ${calificaciones.map(c => `<tr><td data-label="Materia">${c.materia_nombre}</td><td data-label="Estudiante">${c.estudiante_nombre}</td><td data-label="Actividad">${c.actividad_titulo || c.tipo}</td><td data-label="Calificación">${c.calificacion}</td><td data-label="Fecha">${formatearFecha(c.fecha_registro)}</td><td data-label="Acciones"><button type="button" class="btn btn-secondary btn-sm" onclick="editarCalificacion(${c.id}, ${c.calificacion})">Editar</button></td></tr>`).join('')}
        </tbody></table></div>`;
}

async function editarCalificacion(id, actual) {
    const valor = prompt('Nueva calificación (0 - 10):', actual);
    if (valor === null) return;
    const numero = parseFloat(valor);
    if (Number.isNaN(numero) || numero < 0 || numero > 10) {
        mostrarToast('Calificación inválida', 'error');
        return;
    }
    await apiRequest(`/admin/calificaciones/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ calificacion: numero }),
    });
    mostrarToast('Calificación actualizada', 'success');
    await cargarCalificaciones();
}

function previsualizarArchivoAdmin(input) {
    const file = input.files[0];
    if (!file) return;
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (ext === '.pdf') {
        document.getElementById('previewTable').innerHTML = '<div class="alert alert-info">Función en desarrollo. Por favor use formato Excel por ahora.</div>';
        return;
    }
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
        document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">Formato inválido.</div>';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (!rows.length) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">Archivo vacío.</div>';
            return;
        }
        const required = ['Materia', 'Nombre', 'Calificacion'];
        const keys = Object.keys(rows[0]);
        const exact = keys.length === 3 && required.every(k => keys.includes(k));
        if (!exact) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">Formato inválido.</div>';
            return;
        }
        let html = '<h4>Vista previa (5 registros)</h4><div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Nombre</th><th>Calificacion</th></tr></thead><tbody>';
        rows.slice(0, 5).forEach(r => {
            html += `<tr><td>${r.Materia}</td><td>${r.Nombre}</td><td>${r.Calificacion}</td></tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('previewTable').innerHTML = html;
    };
    reader.readAsArrayBuffer(file);
}

window.previsualizarArchivoAdmin = previsualizarArchivoAdmin;
window.editarCalificacion = editarCalificacion;