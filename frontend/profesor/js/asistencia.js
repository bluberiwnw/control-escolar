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
            <td data-label="Matrícula">${e.matricula}</td>
            <td data-label="Nombre">${e.nombre}</td>
            <td data-label="Estado">
                <div class="estado-asistencia">
                    <button type="button" class="btn-estado ${mapaAsistencias[e.id] === 'presente' ? 'presente' : ''}" onclick="cambiarEstado(${e.id}, 'presente')">P</button>
                    <button type="button" class="btn-estado ${mapaAsistencias[e.id] === 'ausente' ? 'ausente' : ''}" onclick="cambiarEstado(${e.id}, 'ausente')">A</button>
                    <button type="button" class="btn-estado ${mapaAsistencias[e.id] === 'retardo' ? 'retardo' : ''}" onclick="cambiarEstado(${e.id}, 'retardo')">R</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.cambiarEstado = async (estudianteId, estado) => {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!materiaId || !fecha) {
        mostrarToast('Selecciona la materia y la fecha antes de registrar asistencia', 'error');
        return;
    }
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

    // Obtener hora actual para sugerencias
    const ahora = new Date();
    const horaActual = ahora.toTimeString().slice(0, 5);
    const horaSugeridaInicio = horaActual;
    const horaSugeridaFin = new Date(ahora.getTime() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5);

    const hora_inicio = window.prompt(`Hora inicio (HH:MM):`, horaSugeridaInicio);
    if (!hora_inicio) return;
    
    const hora_fin = window.prompt(`Hora fin (HH:MM):`, horaSugeridaFin);
    if (!hora_fin) return;
    
    if (!/^\d{2}:\d{2}$/.test(hora_inicio) || !/^\d{2}:\d{2}$/.test(hora_fin)) {
        mostrarToast('Usa formato de hora HH:MM (ej: 08:00)', 'error');
        return;
    }
    
    // Validar rango de horas
    const [hi, mi] = hora_inicio.split(':').map(Number);
    const [hf, mf] = hora_fin.split(':').map(Number);
    const minutosInicio = hi * 60 + mi;
    const minutosFin = hf * 60 + mf;
    
    if (minutosInicio >= minutosFin) {
        mostrarToast('La hora final debe ser posterior a la hora inicial', 'error');
        return;
    }
    
    if (minutosFin - minutosInicio > 240) { // Máximo 4 horas
        mostrarToast('El rango de tiempo no debe exceder 4 horas', 'error');
        return;
    }

    try {
        mostrarToast('Generando código QR...', 'info');
        const data = await apiRequest('/qr/generar', {
            method: 'POST',
            body: JSON.stringify({ materia_id: parseInt(materiaId), fecha, hora_inicio, hora_fin })
        });

        // Mostrar QR con información detallada
        const container = document.getElementById('qrContainer');
        container.innerHTML = `
            <div class="panel-card" style="background:white; padding:20px; display:inline-block; border-radius:20px; max-width:100%;">
                <h3 style="margin:0 0 15px 0; color:#333; text-align:center;">Código QR de Asistencia</h3>
                <img src="${data.qrDataUrl}" style="max-width:300px; width:100%; height:auto;" alt="QR">
                <div style="margin:15px 0; padding:10px; background:#f8f9fa; border-radius:8px; font-size:0.9rem; color:#666;">
                    <strong>Materia:</strong> ${document.getElementById('materiaSelect').options[document.getElementById('materiaSelect').selectedIndex].text}<br>
                    <strong>Fecha:</strong> ${fecha}<br>
                    <strong>Válido:</strong> ${hora_inicio} - ${hora_fin}<br>
                    <small style="color:#999;">Los alumnos tienen 5 minutos de tolerancia</small>
                </div>
                <div style="text-align:center;">
                    <a href="${data.download_url || data.qrDataUrl}" download="qr_asistencia_${fecha.replace(/-/g, '')}.png" class="btn btn-primary">
                        <i class="fas fa-download"></i> Descargar QR
                    </a>
                </div>
            </div>
        `;
        mostrarToast('QR generado correctamente. Muestra este código a tus alumnos.', 'success');
    } catch (error) {
        mostrarToast('Error al generar QR: ' + (error.message || 'Intenta de nuevo'), 'error');
    }
}

window.generarQR = generarQR;