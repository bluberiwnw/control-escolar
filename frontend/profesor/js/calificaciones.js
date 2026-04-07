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