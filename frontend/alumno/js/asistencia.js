let html5QrCode;

async function cargarHistorial() {
    const historial = await apiRequest('/alumno/asistencias');
    document.getElementById('historialAsistencias').innerHTML = `
        <table class="table"><thead><tr><th>Fecha</th><th>Materia</th><th>Estado</th></tr></thead><tbody>
        ${historial.map(h => `<tr><td>${formatearFecha(h.fecha)}</td><td>${h.materia_nombre}</td><td>${h.estado}</td></tr>`).join('')}
        </tbody></table>
    `;
}

function iniciarLectorQR() {
    const readerElement = document.getElementById("reader");
    if (!readerElement) return;
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        // Extraer el parámetro 'code' de la URL
        let codigo = null;
        try {
            const url = new URL(decodedText);
            codigo = url.searchParams.get('code');
        } catch(e) {
            // Si no es una URL válida, quizás el QR contiene solo el código
            codigo = decodedText;
        }
        if (!codigo) {
            mostrarToast('QR inválido: no se encontró código', 'error');
            return;
        }
        // Registrar asistencia
        const data = await apiRequest('/qr/validar', {
            method: 'POST',
            body: JSON.stringify({ codigo })
        });
        mostrarToast(data.message || 'Asistencia registrada', 'success');
        await cargarHistorial();  // recargar historial de asistencias
        html5QrCode.stop();
    }).catch(err => {
        console.error("Error al iniciar lector:", err);
        mostrarToast('No se pudo acceder a la cámara', 'error');
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    await cargarHistorial();
    iniciarLectorQR();
});