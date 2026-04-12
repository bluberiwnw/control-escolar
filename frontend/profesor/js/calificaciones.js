document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarMaterias();
    await cargarHistorial();
});

async function cargarMaterias() {
    const materias = await apiRequest('/materias');
    const select = document.getElementById('materiaSelect');
    select.innerHTML = '<option value="">Seleccionar materia</option>' + materias.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

async function subirArchivo(input) {
    const file = input.files[0];
    const materia_id = document.getElementById('materiaSelect').value;
    const tipo = document.getElementById('tipoSelect').value;
    if (!materia_id) { alert('Selecciona una materia'); return; }
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('materia_id', materia_id);
    formData.append('tipo', tipo);
    const token = localStorage.getItem('token');
    const res = await fetch(`${window.API_URL}/calificaciones/upload`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
    });
    const data = await res.json();
    document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-success">${data.message}<br>${data.archivo.detalles || ''}</div>`;
    cargarHistorial();
}

async function cargarHistorial() {
    const archivos = await apiRequest('/calificaciones/archivos');
    document.getElementById('archivosList').innerHTML = archivos.map(a => `<div class="archivo-item"><div><strong>${a.nombre_archivo}</strong><br><small>${a.tipo} - ${new Date(a.fecha_subida).toLocaleDateString()}</small></div><span class="archivo-estado">${a.estado}</span></div>`).join('');
}


// Función para leer y validar el archivo Excel/CSV
async function previsualizarArchivo(input) {
    const file = input.files[0];
    if (!file) return;

    // Validar extensión
    const validExt = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExt.includes(ext)) {
        document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">Solo se permiten archivos Excel (.xlsx, .xls) o CSV.</div>';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (rows.length === 0) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">El archivo está vacío.</div>';
            return;
        }

        // Validar columnas requeridas (exactamente esos nombres)
        const requiredCols = ['Materia', 'Nombre', 'Calificacion'];
        const firstRow = rows[0];
        const missing = requiredCols.filter(col => !firstRow.hasOwnProperty(col));
        if (missing.length) {
            document.getElementById('previewTable').innerHTML = `<div class="alert alert-error">Error: Faltan columnas: ${missing.join(', ')}. Asegúrate de que los encabezados sean exactamente "Materia", "Nombre", "Calificacion".</div>`;
            return;
        }

        // Mostrar previsualización (primeras 10 filas)
        let html = `<h4>Vista previa (primeros 10 registros)</h4>
                    <table class="asistencia-tabla">
                        <thead><tr>${requiredCols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
                        <tbody>`;
        rows.slice(0, 10).forEach(row => {
            html += `<tr>
                        <td>${row.Materia}</td>
                        <td>${row.Nombre}</td>
                        <td>${row.Calificacion}</td>
                     </tr>`;
        });
        html += `</tbody></table>
                 <button class="btn-login-buap" onclick="confirmarSubida()">Confirmar subida</button>`;
        document.getElementById('previewTable').innerHTML = html;

        // Guardar archivo temporalmente para subir después
        window.tempFile = file;
    };
    reader.readAsArrayBuffer(file);
}

async function confirmarSubida() {
    if (!window.tempFile) {
        mostrarToast('No hay archivo para subir', 'error');
        return;
    }
    const materia_id = document.getElementById('materiaSelect').value;
    const tipo = document.getElementById('tipoSelect').value;
    if (!materia_id) {
        mostrarToast('Seleccione una materia', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('archivo', window.tempFile);
    formData.append('materia_id', materia_id);
    formData.append('tipo', tipo);

    const token = localStorage.getItem('token');
    const res = await fetch(`${window.API_URL}/calificaciones/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    const data = await res.json();
    if (res.ok) {
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-success">${data.message}<br>${data.archivo.detalles || ''}</div>`;
        cargarHistorial();   // recargar lista de archivos subidos
        document.getElementById('previewTable').innerHTML = ''; // limpiar preview
        window.tempFile = null;
    } else {
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-error">${data.message || 'Error al subir'}</div>`;
    }
}