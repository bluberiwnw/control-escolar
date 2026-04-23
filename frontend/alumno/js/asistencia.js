let html5QrCode;
let escaneoBloqueado = false;
let materiaSeleccionadaId = null;

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

function obtenerMateriaIdQR() {
    const sel = document.getElementById('materiaQRSelect');
    const v = sel?.value;
    if (!v) return null;
    const n = Number.parseInt(v, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function actualizarEstadoMateria() {
    const id = obtenerMateriaIdQR();
    materiaSeleccionadaId = id;
    const resumen = document.getElementById('resumenMateriaQR');
    const texto = document.getElementById('resumenMateriaQRText');
    const btn = document.getElementById('btnIniciarCamara');
    const sel = document.getElementById('materiaQRSelect');
    if (!id || !sel) {
        resumen.hidden = true;
        if (btn) btn.disabled = true;
        return;
    }
    const opt = sel.options[sel.selectedIndex];
    const nombre = opt ? opt.textContent : '';
    texto.textContent = `Asistencia en: ${nombre}`;
    resumen.hidden = false;
    if (btn) btn.disabled = false;
}

async function cargarHistorial() {
    const historial = await apiRequest('/alumno/asistencias');
    const el = document.getElementById('historialAsistencias');
    if (!historial.length) {
        el.innerHTML = '<div class="empty-state">No hay asistencias registradas.</div>';
        return;
    }
    el.innerHTML = `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Materia</th><th>Estado</th></tr></thead><tbody>
        ${historial.map(h => `<tr><td data-label="Fecha">${formatearFecha(h.fecha)}</td><td data-label="Materia">${h.materia_nombre}</td><td data-label="Estado">${h.estado}</td></tr>`).join('')}
        </tbody></table></div>`;
}

async function cargarMateriasEnSelects() {
    const materias = await apiRequest('/alumno/materias');
    const opciones =
        '<option value="">Selecciona una materia</option>' +
        materias.map((m) => `<option value="${m.id}">${m.nombre}</option>`).join('');

    const qrSel = document.getElementById('materiaQRSelect');
    const manSel = document.getElementById('materiaManualAsistencia');
    if (qrSel) qrSel.innerHTML = opciones;
    if (manSel) manSel.innerHTML = opciones;
    actualizarEstadoMateria();
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

function setMensajeInfo(msg, esError) {
    const p = document.getElementById('mensajeQRInfo');
    if (!p) return;
    p.textContent = msg || '';
    p.classList.toggle('asistencia-aviso--error', !!esError);
}

async function detenerCamara() {
    const region = document.getElementById('qrScannerRegion');
    const btnDet = document.getElementById('btnDetenerCamara');
    const btnIni = document.getElementById('btnIniciarCamara');
    escaneoBloqueado = false;
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
        } catch (_) {
            /* ignore */
        }
        html5QrCode = null;
    }
    if (region) region.hidden = true;
    if (btnDet) btnDet.hidden = true;
    if (btnIni) btnIni.hidden = false;
    setMensajeInfo('');
}

async function iniciarLectorQR() {
    const mid = obtenerMateriaIdQR();
    if (!mid) {
        mostrarToast('Primero elige la materia', 'error');
        return;
    }
    const readerEl = document.getElementById('reader');
    const region = document.getElementById('qrScannerRegion');
    const btnDet = document.getElementById('btnDetenerCamara');
    const btnIni = document.getElementById('btnIniciarCamara');
    if (!readerEl || !region) return;

    if (html5QrCode) {
        await detenerCamara();
    }

    readerEl.innerHTML = '';
    region.hidden = false;
    if (btnDet) btnDet.hidden = false;
    if (btnIni) btnIni.hidden = true;
    setMensajeInfo('Apunta al código del profesor. Si falla, revisa el mensaje: fecha u hora incorrecta.');

    html5QrCode = new Html5Qrcode('reader');
    const w = Math.min(320, readerEl.clientWidth || 300);
    const config = { fps: 8, qrbox: { width: Math.min(260, w - 20), height: Math.min(260, w - 20) } };

    html5QrCode
        .start({ facingMode: 'environment' }, config, async (decodedText) => {
            if (escaneoBloqueado) return;
            const codigo = extraerCodigoQR(decodedText);
            if (!codigo) {
                mostrarToast('No se pudo leer el código del QR', 'error');
                return;
            }
            escaneoBloqueado = true;
            try {
                try {
                    await html5QrCode.pause(true);
                } catch (_) {
                    /* ignore */
                }
                const tiempoInicio = Date.now();
                const data = await apiRequest(
                    '/qr/validar',
                    {
                        method: 'POST',
                        body: JSON.stringify({ codigo, materia_id: mid }),
                    },
                    false
                );
                
                const tiempoFin = Date.now();
                const tiempoEscaneo = ((tiempoFin - tiempoInicio) / 1000).toFixed(2);
                
                // Mostrar mensaje detallado con tiempo de escaneo
                const mensajeDetallado = `${data.message || 'Asistencia registrada'} (Tiempo: ${tiempoEscaneo}s)`;
                mostrarToast(mensajeDetallado, 'success');
                
                // Mostrar información adicional en el mensaje QR
                setMensajeInfo(`✅ Escaneo completado en ${tiempoEscaneo} segundos. Hora: ${new Date().toLocaleTimeString()}`, false);
                
                // Agregar al historial con timestamp
                await cargarHistorial();
                await detenerCamara();
            } catch (err) {
                const msg = err.message || 'No se pudo registrar la asistencia';
                mostrarToast(msg, 'error');
                setMensajeInfo(msg, true);
                escaneoBloqueado = false;
                try {
                    await html5QrCode.resume();
                } catch (_) {
                    await detenerCamara();
                    mostrarToast('Reinicia la cámara con el botón «Activar cámara».', 'error');
                }
            }
        })
        .catch((err) => {
            console.error('Error al iniciar lector:', err);
            mostrarToast('No se pudo acceder a la cámara. Revisa permisos del navegador.', 'error');
            setMensajeInfo('Permite el uso de la cámara para este sitio.', true);
            detenerCamara();
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

    document.getElementById('materiaQRSelect')?.addEventListener('change', actualizarEstadoMateria);

    document.getElementById('btnIniciarCamara')?.addEventListener('click', () => {
        iniciarLectorQR();
    });
    document.getElementById('btnDetenerCamara')?.addEventListener('click', () => {
        detenerCamara();
    });

    await cargarHistorial();
    await cargarMateriasEnSelects();
});

window.registrarAsistenciaManual = registrarAsistenciaManual;
