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
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10 }, async (decodedText) => {
        const url = new URL(decodedText);
        const codigo = url.searchParams.get('code');
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/alumno/asistencia-qr`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ codigo })
        });
        const data = await res.json();
        const mensajeDiv = document.getElementById('mensajeQR');
        if (res.ok) {
            mensajeDiv.className = 'alert alert-success';
            mensajeDiv.textContent = '✅ Asistencia registrada';
            cargarHistorial();
        } else {
            mensajeDiv.className = 'alert alert-error';
            mensajeDiv.textContent = '❌ ' + (data.error || 'Error');
        }
        mensajeDiv.style.display = 'block';
        setTimeout(() => mensajeDiv.style.display = 'none', 3000);
        setTimeout(() => html5QrCode.stop(), 5000);
    }).catch(err => console.error(err));
}