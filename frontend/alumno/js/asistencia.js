let html5QrCode;

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarHistorial();
    iniciarLectorQR();
});

async function cargarHistorial() {
    const historial = await apiRequest('/alumno/asistencias');
    document.getElementById('historialAsistencias').innerHTML = `
        <table class="table"><thead><tr><th>Fecha</th><th>Materia</th><th>Estado</th></tr></thead><tbody>
        ${historial.map(h => `<tr><td>${formatearFecha(h.fecha)}</td><td>${h.materia_nombre}</td><td>${h.estado}</td></tr>`).join('')}
        </tbody></table>
    `;
}

function iniciarLectorQR() {
    const html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10 }, async (decodedText) => {
        const url = new URL(decodedText);
        const codigo = url.searchParams.get('code');
        if (!codigo) { alert('QR no válido'); return; }
        const data = await apiRequest('/qr/validar', { method: 'POST', body: JSON.stringify({ codigo }) });
        mostrarToast(data.message || 'Asistencia registrada', 'success');
        cargarHistorial();
        html5QrCode.stop();
    }).catch(err => console.error(err));
}