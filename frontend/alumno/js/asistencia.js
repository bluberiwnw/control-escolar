let html5QrCode;
let escaneoBloqueado = false;
let materiaSeleccionadaId = null;

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMateriasEnSelects();
    await cargarHistorial();
    
    // Sistema online - no hay sincronización offline
});

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
    el.innerHTML = 
        `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Materia</th><th>Estado</th></tr></thead><tbody>
            ${historial.map(h => `<tr>
                <td data-label="Fecha"><span class="fecha-destacada">${formatearFecha(h.fecha)}</span></td>
                <td data-label="Materia">${h.materia_nombre}</td>
                <td data-label="Estado">${getEstadoBadge(h.estado)}</td>
            </tr>`).join('')}
        </tbody></table></div>`;
}

function getEstadoBadge(estado) {
    const badges = {
        'presente': '<span class="badge badge-success" style="font-size: 0.85rem; padding: 4px 8px; border-radius: 12px; font-weight: 600;">✓ Presente</span>',
        'ausente': '<span class="badge badge-danger" style="font-size: 0.85rem; padding: 4px 8px; border-radius: 12px; font-weight: 600;">✗ Ausente</span>',
        'retardo': '<span class="badge badge-warning" style="font-size: 0.85rem; padding: 4px 8px; border-radius: 12px; font-weight: 600;">⏱ Retardo</span>'
    };
    return badges[estado] || `<span class="badge badge-info" style="font-size: 0.85rem; padding: 4px 8px; border-radius: 12px; font-weight: 600;">${estado}</span>`;
}

async function cargarMateriasEnSelects() {
    try {
        console.log('🔄 Cargando materias del alumno...');
        const materias = await apiRequest('/alumno/materias');
        console.log('✅ Materias recibidas:', materias);
        
        if (!Array.isArray(materias)) {
            console.error('❌ Las materias no son un array:', materias);
            mostrarToast('Error al cargar materias: formato incorrecto', 'error');
            return;
        }
        
        if (materias.length === 0) {
            console.log('⚠️ El alumno no está inscrito en ninguna materia');
            mostrarToast('No estás inscrito en ninguna materia. Contacta al administrador.', 'warning');
            
            // Mostrar mensaje en los selects
            const opciones = '<option value="">No hay materias disponibles</option>';
            const qrSel = document.getElementById('materiaQRSelect');
            const manSel = document.getElementById('materiaManualAsistencia');
            if (qrSel) {
                qrSel.innerHTML = opciones;
                qrSel.disabled = true;
            }
            if (manSel) {
                manSel.innerHTML = opciones;
                manSel.disabled = true;
            }
            actualizarEstadoMateria();
            return;
        }
        
        const opciones =
            '<option value="">Selecciona una materia</option>' +
            materias.map((m) => `<option value="${m.id}">${m.nombre}</option>`).join('');

        const qrSel = document.getElementById('materiaQRSelect');
        const manSel = document.getElementById('materiaManualAsistencia');
        if (qrSel) {
            qrSel.innerHTML = opciones;
            qrSel.disabled = false;
        }
        if (manSel) {
            manSel.innerHTML = opciones;
            manSel.disabled = false;
        }
        
        console.log('✅ Materias cargadas exitosamente en los selects');
        actualizarEstadoMateria();
        
    } catch (error) {
        console.error('❌ Error al cargar materias:', error);
        mostrarToast('Error al cargar materias: ' + (error.message || 'Intenta recargar la página'), 'error');
        
        // Deshabilitar selects en caso de error
        const opciones = '<option value="">Error al cargar</option>';
        const qrSel = document.getElementById('materiaQRSelect');
        const manSel = document.getElementById('materiaManualAsistencia');
        if (qrSel) {
            qrSel.innerHTML = opciones;
            qrSel.disabled = true;
        }
        if (manSel) {
            manSel.innerHTML = opciones;
            manSel.disabled = true;
        }
        actualizarEstadoMateria();
    }
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
    if (!readerEl || !region) {
        mostrarToast('Error: elementos de cámara no encontrados', 'error');
        return;
    }

    if (html5QrCode) {
        await detenerCamara();
    }

    readerEl.innerHTML = '';
    region.hidden = false;
    if (btnDet) btnDet.hidden = false;
    if (btnIni) btnIni.hidden = true;
    setMensajeInfo('Iniciando cámara... por favor espera.');

    // Verificar si el navegador soporta la API de cámara
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        mostrarToast('Tu navegador no soporta acceso a la cámara', 'error');
        setMensajeInfo('Usa un navegador moderno como Chrome, Firefox o Safari', true);
        detenerCamara();
        return;
    }

    html5QrCode = new Html5Qrcode('reader');
    const w = Math.min(320, readerEl.clientWidth || 300);
    const config = { 
        fps: 8, 
        qrbox: { width: Math.min(260, w - 20), height: Math.min(260, w - 20) },
        supportedScanTypes: [0] // Solo QR codes
    };

    try {
        // Intentar primero con la cámara trasera
        await html5QrCode.start({ facingMode: 'environment' }, config, async (decodedText) => {
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
                // Enviar datos adicionales para validación de sesión única
                let data;
                try {
                    data = await apiRequest(
                        '/qr/validar',
                        {
                            method: 'POST',
                            body: JSON.stringify({ 
                                codigo, 
                                materia_id: mid,
                                timestamp: Date.now(),  // Timestamp actual para validación
                                alumno_id: obtenerAlumnoId()  // ID del alumno para registro
                            }),
                        },
                        false
                    );
                } catch (error) {
                    console.log('❌ Error en endpoint /qr/validar:', error.message);
                    
                    // Mostrar error al usuario - no hay modo offline
                    mostrarToast(`Error al registrar asistencia: ${error.message}`, 'error');
                    await detenerCamara();
                    return;
                }
                
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
                // Manejo específico de errores para QR únicos
                let msg = err.message || 'No se pudo registrar la asistencia';
                
                if (err.message.includes('sesión')) {
                    msg = '❌ QR de sesión no válido o expirado';
                } else if (err.message.includes('profesor')) {
                    msg = '❌ Este QR no pertenece a tu materia o profesor';
                } else if (err.message.includes('expirado')) {
                    msg = '❌ El QR ha expirado. La clase ya finalizó';
                } else if (err.message.includes('temprano')) {
                    msg = '❌ Es demasiado temprano para usar este QR';
                } else if (err.message.includes('utilizado')) {
                    msg = '❌ Este QR ya ha sido utilizado';
                } else if (err.message.includes('inválido')) {
                    msg = '❌ QR inválido o corrupto';
                }
                
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
        });
        
        setMensajeInfo('📷 Cámara activada. Apunta al código QR del profesor.');
        
    } catch (error) {
        console.error('Error con cámara trasera:', error);
        
        // Intentar con cámara frontal como fallback
        try {
            setMensajeInfo('Intentando con cámara frontal...');
            await html5QrCode.start({ facingMode: 'user' }, config, async (decodedText) => {
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
                    
                    const mensajeDetallado = `${data.message || 'Asistencia registrada'} (Tiempo: ${tiempoEscaneo}s)`;
                    mostrarToast(mensajeDetallado, 'success');
                    
                    setMensajeInfo(`✅ Escaneo completado en ${tiempoEscaneo} segundos. Hora: ${new Date().toLocaleTimeString()}`, false);
                    
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
            });
            setMensajeInfo('📷 Cámara frontal activada. Apunta al código QR del profesor.');
        } catch (fallbackError) {
            console.error('Error con cámara frontal:', fallbackError);
            mostrarToast('No se pudo acceder a ninguna cámara. Verifica los permisos.', 'error');
            setMensajeInfo('💡 Asegúrate de permitir el acceso a la cámara en tu navegador y recarga la página.', true);
            detenerCamara();
        }
    }
}

// Función para obtener ID del alumno actual
function obtenerAlumnoId() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData.id || userData.alumno_id || userData.usuario_id;
}

// Event listeners para botones de cámara
document.getElementById('btnIniciarCamara')?.addEventListener('click', () => {
    iniciarLectorQR();
});
document.getElementById('btnDetenerCamara')?.addEventListener('click', () => {
    detenerCamara();
});

// Event listener para cambio de materia
document.getElementById('materiaQRSelect')?.addEventListener('change', () => {
    actualizarEstadoMateria();
});

window.registrarAsistenciaManual = registrarAsistenciaManual;

// Sistema online - no hay sincronización offline
function sincronizarAsistenciasPendientes() {
    // Función vacía - sistema funciona solo online
    console.log('📡 Sistema online - no hay asistencias pendientes');
}

// Exponer función global
window.sincronizarAsistenciasPendientes = sincronizarAsistenciasPendientes;
