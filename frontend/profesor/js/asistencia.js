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
async function cargarLista() { /* similar al anterior */ }
async function generarQR() {
    const materia_id = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    const hora_inicio = prompt('Hora inicio (HH:MM):', '08:00');
    const hora_fin = prompt('Hora fin (HH:MM):', '10:00');
    if (!materia_id || !fecha) return;
    const data = await apiRequest('/profesor/qr', { method: 'POST', body: JSON.stringify({ materia_id, fecha, hora_inicio, hora_fin }) });
    document.getElementById('qrContainer').innerHTML = `<img src="${data.qrDataUrl}" style="max-width:200px;"><br><a href="${data.url}" target="_blank">Enlace</a>`;
}