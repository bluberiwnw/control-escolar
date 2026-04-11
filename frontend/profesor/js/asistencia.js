document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarMaterias();
    document.getElementById('fechaAsistencia').valueAsDate = new Date();
    document.getElementById('fechaAsistencia').addEventListener('change', cargarLista);
    document.getElementById('materiaSelect').addEventListener('change', cargarLista);
});

async function cargarMaterias() {
    const materias = await apiRequest('/materias');
    const select = document.getElementById('materiaSelect');
    select.innerHTML = '<option value="">Seleccionar materia</option>' + materias.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

async function cargarLista() {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!materiaId || !fecha) return;
    
    // Obtener estudiantes inscritos en la materia
    const estudiantes = await apiRequest(`/materias/${materiaId}/estudiantes-inscritos`);
    // Obtener asistencias ya registradas para esa fecha
    const asistencias = await apiRequest(`/asistencia/${materiaId}/${fecha}`);
    const mapaAsistencias = {};
    asistencias.forEach(a => { mapaAsistencias[a.estudiante_id] = a.estado; });
    
    const tbody = document.getElementById('listaEstudiantes');
    tbody.innerHTML = estudiantes.map(e => `
        <tr data-estudiante-id="${e.id}">
            <td>${e.matricula}</td>
            <td>${e.nombre}</td>
            <td>
                <div class="estado-asistencia">
                    <button class="btn-estado ${mapaAsistencias[e.id] === 'presente' ? 'presente' : ''}" onclick="cambiarEstado(${e.id}, 'presente')">P</button>
                    <button class="btn-estado ${mapaAsistencias[e.id] === 'ausente' ? 'ausente' : ''}" onclick="cambiarEstado(${e.id}, 'ausente')">A</button>
                    <button class="btn-estado ${mapaAsistencias[e.id] === 'retardo' ? 'retardo' : ''}" onclick="cambiarEstado(${e.id}, 'retardo')">R</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.cambiarEstado = async (estudianteId, estado) => {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    await apiRequest('/asistencia', { method: 'POST', body: JSON.stringify({ materia_id: parseInt(materiaId), estudiante_id: estudianteId, fecha, estado }) });
    cargarLista(); // recargar para mostrar cambios
};

async function generarQR() {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!materiaId || !fecha) { alert('Selecciona materia y fecha'); return; }
    const hora_inicio = prompt('Hora inicio (HH:MM):', '08:00');
    const hora_fin = prompt('Hora fin (HH:MM):', '10:00');
    if (!hora_inicio || !hora_fin) return;
    const data = await apiRequest('/qr/generar', { method: 'POST', body: JSON.stringify({ materia_id: parseInt(materiaId), fecha, hora_inicio, hora_fin }) });
    document.getElementById('qrContainer').innerHTML = `<img src="${data.qrDataUrl}" style="max-width:200px;"><br><a href="${data.url}" target="_blank">Enlace para compartir</a>`;
}