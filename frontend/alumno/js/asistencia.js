let html5QrCode;
let escaneoBloqueado = false;

function extraerCodigoQR(decodedText) {
    const t = String(decodedText || '').trim();
    if (!t) return null;
    try {
        const parsed = JSON.parse(t);
        if (parsed && parsed.token_unico) return String(parsed.token_unico);
    } catch (_) {
        /* no es JSON */
    }
    try {
        const url = new URL(t);
        const c = url.searchParams.get('code');
        if (c) return c;
    } catch (_) {
        /* texto plano */
    }
    return t;
}

async function cargarHistorial() {
    const historial = await apiRequest('/alumno/asistencias');
    if (!historial.length) {
        document.getElementById('historialAsistencias').innerHTML = '<div class="empty-state">No hay asistencias registradas.</div>';
        return;
    }
    document.getElementById('historialAsistencias').innerHTML = `<div class="table-responsive-wrap">
        <table class="data-table"><thead><tr><th>Fecha</th><th>Materia</th><th>Estado</th></tr></thead><tbody>
        ${historial.map(h => `<tr><td data-label="Fecha">${formatearFecha(h.fecha)}</td><td data-label="Materia">${h.materia_nombre}</td><td data-label="Estado">${h.estado}</td></tr>`).join('')}
        </tbody></table></div>`;
}

async function cargarMateriasManual() {
    const sel = document.getElementById('materiaManualAsistencia');
    if (!sel) return;
    const materias = await apiRequest('/alumno/materias');
    sel.innerHTML = '<option value="">Selecciona tu materia</option>' + materias.map((m) => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

async function registrarAsistenciaManual() {
    const materia_id = document.getElementById('materiaManualAsistencia')?.value;
    const fecha = document.getElementById('fechaManualAsistencia')?.value;
    if (!materia_id || !fecha) {
        mostrarToast('Selecciona materia y fecha', 'error');
        return;
    }
    try {
        const data = await apiRequest('/alumno/asistencias/manual', {
            method: 'POST',
            body: JSON.stringify({ materia_id: parseInt(materia_id, 10), fecha }),
        });
        mostrarToast(data.message || 'Listo', 'success');
        await cargarHistorial();
    } catch (err) {
        mostrarToast(err.message || 'No se pudo registrar', 'error');
    }
}

function iniciarLectorQR() {
    const readerElement = document.getElementById('reader');
    if (!readerElement) return;
    html5QrCode = new Html5Qrcode('reader');
    const config = { fps: 8, qrbox: { width: 250, height: 250 } };
    html5QrCode
        .start({ facingMode: 'environment' }, config, async (decodedText) => {
            if (escaneoBloqueado) return;
            const codigo = extraerCodigoQR(decodedText);
            if (!codigo) {
                mostrarToast('QR inválido: no se encontró código', 'error');
                return;
            }
            escaneoBloqueado = true;
            try {
                try {
                    await html5QrCode.pause(true);
                } catch (_) {
                    /* ignore */
                }
                const data = await apiRequest(
                    '/qr/validar',
                    { method: 'POST', body: JSON.stringify({ codigo }) },
                    false
                );
                mostrarToast(data.message || 'Asistencia registrada', 'success');
                await cargarHistorial();
                await html5QrCode.stop();
            } catch (err) {
                mostrarToast(err.message || 'No se pudo registrar la asistencia', 'error');
                escaneoBloqueado = false;
                try {
                    await html5QrCode.resume();
                } catch (_) {
                    try {
                        await html5QrCode.stop();
                    } catch (__) {
                        /* ignore */
                    }
                    iniciarLectorQR();
                }
            }
        })
        .catch((err) => {
            console.error('Error al iniciar lector:', err);
            mostrarToast('No se pudo acceder a la cámara', 'error');
        });
}

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    const fechaManual = document.getElementById('fechaManualAsistencia');
    if (fechaManual) {
        fechaManual.valueAsDate = new Date();
    }
    await cargarHistorial();
    await cargarMateriasManual();
    iniciarLectorQR();
});

window.registrarAsistenciaManual = registrarAsistenciaManual;
