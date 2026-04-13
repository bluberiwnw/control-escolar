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
    await apiRequest('/asistencia', { method: 'POST', body: JSON.stringify({ materia_id: parseInt(materiaId, 10), estudiante_id: estudianteId, fecha, estado }) });
    mostrarToast('Asistencia actualizada', 'success');
    cargarLista(); // recargar para mostrar cambios
};

async function generarQR() {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!materiaId || !fecha) {
        mostrarToast('Selecciona materia y fecha', 'error');
        return;
    }
    const hora_inicio = window.prompt('Hora inicio (HH:MM):', '08:00');
    const hora_fin = window.prompt('Hora fin (HH:MM):', '10:00');
    if (!hora_inicio || !hora_fin) return;
    if (!/^\d{2}:\d{2}$/.test(hora_inicio) || !/^\d{2}:\d{2}$/.test(hora_fin)) {
        mostrarToast('Usa formato de hora HH:MM', 'error');
        return;
    }

    const data = await apiRequest('/qr/generar', {
        method: 'POST',
        body: JSON.stringify({ materia_id: parseInt(materiaId), fecha, hora_inicio, hora_fin })
    });

    // Mostrar QR grande y botón de descarga
    const container = document.getElementById('qrContainer');
    container.innerHTML = `
        <div style="background:white; padding:20px; display:inline-block; border-radius:20px;">
            <img src="${data.qrDataUrl}" style="max-width:300px; width:100%;" alt="QR">
            <br><br>
            <a href="${data.qrDataUrl}" download="qr_asistencia.png" class="btn-login-buap">Descargar QR</a>
            <p class="text-muted" style="margin-top:10px;">URL para compartir: <a href="${data.url}" target="_blank" rel="noopener">${data.url}</a></p>
            <button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="copiarURLQR('${data.url}')">Copiar URL</button>
        </div>
    `;
    mostrarToast('QR generado correctamente', 'success');
}

function copiarURLQR(url) {
    navigator.clipboard.writeText(url).then(
        () => mostrarToast('URL copiada', 'success'),
        () => mostrarToast('No se pudo copiar la URL', 'error')
    );
}

window.generarQR = generarQR;
window.copiarURLQR = copiarURLQR;