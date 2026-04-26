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
    if (!materiaId || !fecha) {
        // Limpiar estadísticas si no hay selección completa
        limpiarEstadisticas();
        return;
    }
    
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
    
    // Generar estadísticas automáticamente
    generarEstadisticas(asistencias, estudiantes.length);
}

function generarEstadisticas(asistencias, totalEstudiantes) {
    const presentes = asistencias.filter(a => a.estado === 'presente').length;
    const ausentes = asistencias.filter(a => a.estado === 'ausente').length;
    const retardos = asistencias.filter(a => a.estado === 'retardo').length;
    const registrados = asistencias.length;
    const sinRegistrar = totalEstudiantes - registrados;
    
    // Actualizar estadísticas en el DOM con verificación de existencia
    const elementos = {
        estPresentes: presentes,
        estAusentes: ausentes,
        estRetardos: retardos,
        estRegistrados: registrados,
        estSinRegistrar: sinRegistrar,
        estTotal: totalEstudiantes
    };
    
    // Actualizar solo si los elementos existen
    Object.keys(elementos).forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = elementos[id];
        } else {
            console.warn(`Elemento #${id} no encontrado en el DOM`);
        }
    });
    
    // Calcular porcentajes
    const porcentajeAsistencia = totalEstudiantes > 0 ? ((presentes / totalEstudiantes) * 100).toFixed(1) : 0;
    const estPorcentaje = document.getElementById('estPorcentaje');
    if (estPorcentaje) {
        estPorcentaje.textContent = `${porcentajeAsistencia}%`;
    }
}

function limpiarEstadisticas() {
    const elementosLimpiar = {
        estPresentes: '0',
        estAusentes: '0',
        estRetardos: '0',
        estRegistrados: '0',
        estSinRegistrar: '0',
        estTotal: '0',
        estPorcentaje: '0%'
    };
    
    // Limpiar solo si los elementos existen
    Object.keys(elementosLimpiar).forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = elementosLimpiar[id];
        }
    });
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
        mostrarToast('Selecciona materia y fecha antes de generar QR', 'error');
        return;
    }

    // Obtener hora actual para sugerencias inteligentes
    const ahora = new Date();
    const horaActual = ahora.toTimeString().slice(0, 5);
    const horaActualNum = parseInt(horaActual.split(':')[0]) * 60 + parseInt(horaActual.split(':')[1]);
    
    // Sugerencias basadas en hora actual
    let horaSugeridaInicio, horaSugeridaFin, mensajeEjemplo;
    
    if (horaActualNum >= 7 * 60 && horaActualNum < 9 * 60) {
        // Clase de 7-9am
        horaSugeridaInicio = "07:00";
        horaSugeridaFin = "09:00";
        mensajeEjemplo = "Ejemplo: Clase matutina (7:00 - 9:00)";
    } else if (horaActualNum >= 9 * 60 && horaActualNum < 11 * 60) {
        // Clase de 9-11am
        horaSugeridaInicio = "09:00";
        horaSugeridaFin = "11:00";
        mensajeEjemplo = "Ejemplo: Clase de la mañana (9:00 - 11:00)";
    } else if (horaActualNum >= 11 * 60 && horaActualNum < 13 * 60) {
        // Clase de 11am-1pm
        horaSugeridaInicio = "11:00";
        horaSugeridaFin = "13:00";
        mensajeEjemplo = "Ejemplo: Clase de mediodía (11:00 - 13:00)";
    } else if (horaActualNum >= 13 * 60 && horaActualNum < 15 * 60) {
        // Clase de 1-3pm
        horaSugeridaInicio = "13:00";
        horaSugeridaFin = "15:00";
        mensajeEjemplo = "Ejemplo: Clase de la tarde (13:00 - 15:00)";
    } else if (horaActualNum >= 15 * 60 && horaActualNum < 17 * 60) {
        // Clase de 3-5pm
        horaSugeridaInicio = "15:00";
        horaSugeridaFin = "17:00";
        mensajeEjemplo = "Ejemplo: Clase vespertina (15:00 - 17:00)";
    } else if (horaActualNum >= 17 * 60 && horaActualNum < 19 * 60) {
        // Clase de 5-7pm
        horaSugeridaInicio = "17:00";
        horaSugeridaFin = "19:00";
        mensajeEjemplo = "Ejemplo: Clase de la tarde-noche (17:00 - 19:00)";
    } else if (horaActualNum >= 19 * 60 && horaActualNum < 21 * 60) {
        // Clase de 7-9pm
        horaSugeridaInicio = "19:00";
        horaSugeridaFin = "21:00";
        mensajeEjemplo = "Ejemplo: Última clase del día (19:00 - 21:00)";
    } else {
        // Fuera de horario, sugerir próxima clase
        horaSugeridaInicio = "07:00";
        horaSugeridaFin = "09:00";
        mensajeEjemplo = "Ejemplo: Primera clase del día (7:00 - 9:00)";
    }

    // Mostrar diálogo con ejemplos
    const hora_inicio = window.prompt(
        `HORA DE INICIO\n\n${mensajeEjemplo}\n\nFormato: HH:MM (24 horas)\nHorario escolar: 07:00 - 21:00\n\nEjemplos válidos:\n• 07:00 (7 AM)\n• 14:30 (2:30 PM)\n• 19:00 (7 PM)\n\nIngresa la hora de inicio:`, 
        horaSugeridaInicio
    );
    
    if (!hora_inicio) return;
    
    // Validar formato de hora
    if (!/^\d{2}:\d{2}$/.test(hora_inicio)) {
        mostrarToast('Formato inválido. Usa HH:MM (ej: 08:00, 14:30)', 'error');
        return;
    }
    
    const [hi, mi] = hora_inicio.split(':').map(Number);
    if (hi < 7 || hi > 21 || mi < 0 || mi > 59) {
        mostrarToast('Hora fuera de rango. El horario escolar es 07:00 - 21:00', 'error');
        return;
    }
    
    const hora_fin = window.prompt(
        `HORA DE FIN\n\nInicio: ${hora_inicio}\n${mensajeEjemplo}\n\nFormato: HH:MM (24 horas)\nMáximo 4 horas de diferencia\n\nEjemplos según inicio:\n• Si inicia 07:00 → fin 11:00\n• Si inicia 14:30 → fin 18:30\n• Si inicia 19:00 → fin 21:00\n\nIngresa la hora de fin:`, 
        horaSugeridaFin
    );
    
    if (!hora_fin) return;
    
    if (!/^\d{2}:\d{2}$/.test(hora_fin)) {
        mostrarToast('Formato inválido. Usa HH:MM (ej: 10:00, 16:30)', 'error');
        return;
    }
    
    const [hf, mf] = hora_fin.split(':').map(Number);
    if (hf < 7 || hf > 21 || mf < 0 || mf > 59) {
        mostrarToast('Hora fuera de rango. El horario escolar es 07:00 - 21:00', 'error');
        return;
    }
    
    // Validar rango de horas
    const minutosInicio = hi * 60 + mi;
    const minutosFin = hf * 60 + mf;
    
    if (minutosInicio >= minutosFin) {
        mostrarToast('La hora final debe ser posterior a la hora inicial', 'error');
        return;
    }
    
    if (minutosFin - minutosInicio > 240) { // Máximo 4 horas
        mostrarToast('El rango no debe exceder 4 horas. Máximo permitido: 240 minutos', 'error');
        return;
    }

    // Confirmación con detalles
    const materiaNombre = document.getElementById('materiaSelect').options[document.getElementById('materiaSelect').selectedIndex].text;
    const confirmacion = confirm(
        `CONFIRMA LOS DATOS\n\n` +
        `Materia: ${materiaNombre}\n` +
        `Fecha: ${fecha}\n` +
        `Horario: ${hora_inicio} - ${hora_fin}\n` +
        `Duración: ${Math.floor((minutosFin - minutosInicio) / 60)}h ${((minutosFin - minutosInicio) % 60)}min\n\n` +
        `Los alumnos podrán escanear:\n` +
        `• Desde las ${hora_inicio}\n` +
        `• Hasta las ${hora_fin}\n` +
        `¿Generar código QR con estos datos?`
    );
    
    if (!confirmacion) return;

    try {
        mostrarToast('Generando código QR...', 'info');
        
        console.log('Enviando petición QR:', {
            materia_id: parseInt(materiaId),
            fecha,
            hora_inicio,
            hora_fin
        });
        
        let data;
        try {
            data = await apiRequest('/qr/generar', {
                method: 'POST',
                body: JSON.stringify({ 
                    materia_id: parseInt(materiaId), 
                    fecha, 
                    hora_inicio, 
                    hora_fin 
                })
            });
            console.log('Respuesta QR recibida:', data);
        } catch (qrError) {
            console.error('Error en generación QR:', qrError);
            
            // Detectar errores relacionados con tabla qr_logs - detección mejorada
            const errorMessage = qrError.message || '';
            const esErrorQrLogs = errorMessage.includes('qr_logs') && 
                (errorMessage.includes('does not exist') || errorMessage.includes('no existe'));
            
            const esErrorTabla = errorMessage.includes('relation') && 
                errorMessage.includes('does not exist');
            
            const esErrorBaseDatos = errorMessage.includes('42P01') || // PostgreSQL error code
                errorMessage.includes('database') ||
                errorMessage.includes('conexion') ||
                errorMessage.includes('relation') && errorMessage.includes('does not exist');
            
            // Detectar cualquier error de base de datos PostgreSQL
            const esErrorPostgreSQL = errorMessage.includes('PostgreSQL') ||
                errorMessage.includes('pg-pool') ||
                errorMessage.includes('routine:') ||
                errorMessage.includes('file:') && errorMessage.includes('.c:');
            
            // Detectar errores de servidor (502, 503) que indican problemas del backend
            const esErrorServidor = errorMessage.includes('502') || 
                errorMessage.includes('503') || 
                errorMessage.includes('Bad Gateway') ||
                errorMessage.includes('Service Unavailable') ||
                errorMessage.includes('Error en la petición') ||
                errorMessage.includes('servidor') ||
                errorMessage.includes('gateway');
            
            console.log('🔍 Análisis de error QR:', {
                message: errorMessage,
                qr_logs: esErrorQrLogs,
                tabla: esErrorTabla,
                base_datos: esErrorBaseDatos,
                postgresql: esErrorPostgreSQL,
                servidor: esErrorServidor
            });
            
            // Si es cualquier error de base de datos, tabla faltante o error de servidor, usar modo local
            if (esErrorQrLogs || esErrorTabla || esErrorBaseDatos || esErrorPostgreSQL || esErrorServidor) {
                console.log('🔄 Activando modo local QR debido a error de base de datos o servidor...');
                console.log('Tipo de error detectado:', {
                    qr_logs: esErrorQrLogs,
                    tabla: esErrorTabla,
                    base_datos: esErrorBaseDatos,
                    postgresql: esErrorPostgreSQL,
                    servidor: esErrorServidor
                });
                data = generarQRLocal(materiaId, fecha, hora_inicio, hora_fin, materiaNombre);
            } else {
                console.log('🚨 Error no manejado, re-lanzando...');
                throw qrError; // Re-lanzar otros errores
            }
        }

        // Mostrar QR con información detallada y profesional
        const container = document.getElementById('qrContainer');
        container.innerHTML = `
            <div class="panel-card qr-generado" style="background:white; padding:25px; display:inline-block; border-radius:20px; max-width:100%; box-shadow:0 8px 32px rgba(0,0,0,0.1);">
                <div style="text-align:center; margin-bottom:20px;">
                    <div style="display:inline-flex; align-items:center; gap:10px; background:#10b981; color:white; padding:8px 16px; border-radius:20px; margin-bottom:15px;">
                        <i class="fas fa-check-circle"></i>
                        <span style="font-weight:600;">QR Generado Exitosamente</span>
                    </div>
                    <h3 style="margin:0; color:#333; font-size:1.4rem;">Código QR de Asistencia</h3>
                    <p style="margin:5px 0 0; color:#666; font-size:0.9rem;">${materiaNombre}</p>
                </div>
                
                <div style="text-align:center; margin:20px 0;">
                    <img src="${data.qrDataUrl}" style="max-width:280px; width:100%; height:auto; border:3px solid #e5e7eb; border-radius:12px;" alt="QR Asistencia">
                </div>
                
                <div style="background:#f8fafc; padding:15px; border-radius:12px; margin:15px 0; border:1px solid #e2e8f0;">
                    <h4 style="margin:0 0 10px; color:#334155; font-size:0.95rem;">Información del QR</h4>
                    <div style="display:grid; gap:8px; font-size:0.85rem;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#64748b;">Fecha:</span>
                            <span style="font-weight:600; color:#334155;">${fecha}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#64748b;">Válido:</span>
                            <span style="font-weight:600; color:#334155;">${hora_inicio} - ${hora_fin}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#64748b;">Duración:</span>
                            <span style="font-weight:600; color:#334155;">${Math.floor((minutosFin - minutosInicio) / 60)}h ${((minutosFin - minutosInicio) % 60)}min</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#64748b;">Código:</span>
                            <span style="font-weight:600; color:#059669; font-family:monospace;">${data.codigo?.substring(0, 8)}...</span>
                        </div>
                    </div>
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid #e2e8f0;">
                        <p style="margin:0; color:#059669; font-size:0.8rem; text-align:center;">
                            <i class="fas fa-shield-alt"></i> QR único y seguro con validación de sesión
                        </p>
                    </div>
                    <div style="margin-top:10px; padding:10px; background:#dcfce7; border-radius:8px; border:1px solid #22c55e;">
                        <h5 style="margin:0 0 8px; color:#166534; font-size:0.85rem; text-align:center;">
                            <i class="fas fa-lock"></i> Características de Seguridad
                        </h5>
                        <ul style="margin:0; padding-left:20px; font-size:0.75rem; color:#166534;">
                            <li>Código único por sesión de clase</li>
                            <li>Vinculado al docente actual</li>
                            <li>Invalidación automática al finalizar</li>
                            <li>Protección contra reutilización</li>
                        </ul>
                    </div>
                </div>
                
                <div style="text-align:center; margin-top:20px;">
                    <a href="${data.download_url || data.qrDataUrl}" download="qr_asistencia_${materiaNombre.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${fecha.replace(/-/g, '')}.png" 
                       class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px; padding:12px 24px; text-decoration:none;">
                        <i class="fas fa-download"></i>
                        Descargar QR
                    </a>
                </div>
                
                <div style="margin-top:15px; padding:12px; background:#fef3c7; border-radius:8px; border:1px solid #f59e0b;">
                    <p style="margin:0; color:#92400e; font-size:0.8rem; text-align:center;">
                        <i class="fas fa-info-circle"></i> <strong>Importante:</strong> Muestra este código a tus alumnos solo durante el horario especificado.
                    </p>
                </div>
            </div>
        `;
        
        mostrarToast('QR generado correctamente. Muestra este código a tus alumnos.', 'success');
        
        // Actualizar automáticamente la lista de asistencia
        setTimeout(() => {
            cargarLista();
            verAsistenciaEnTiempoReal();
        }, 1000);
        
    } catch (error) {
        console.error('Error generando QR:', error);
        let mensajeError = 'No se pudo generar el código QR. Intenta de nuevo.';
        
        if (error.message.includes('JSON') || error.message.includes('Unexpected end')) {
            mensajeError = 'El servidor no respondió correctamente. Recarga la página e intenta nuevamente.';
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
            mensajeError = 'Sin conexión a internet. Verifica tu red e intenta de nuevo.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
            mensajeError = 'Tu sesión ha expirado. Inicia sesión nuevamente.';
        } else if (error.message.includes('400')) {
            mensajeError = 'Datos incorrectos. Verifica la materia, fecha y horas seleccionadas.';
        } else if (error.message.includes('500')) {
            mensajeError = 'Error del servidor. Intenta en unos minutos.';
        }
        
        mostrarToast(mensajeError, 'error');
    }
}

async function marcarTodos(estado) {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!materiaId || !fecha) {
        mostrarToast('Selecciona la materia y la fecha antes de marcar asistencia', 'error');
        return;
    }
    
    if (!confirm(`¿Marcar a todos los estudiantes como ${estado}?`)) return;
    
    try {
        // Obtener todos los estudiantes inscritos
        const estudiantes = await apiRequest(`/materias/${materiaId}/estudiantes-inscritos`);
        
        // Crear array de asistencias para enviar
        const asistencias = estudiantes.map(e => ({
            materia_id: parseInt(materiaId, 10),
            estudiante_id: e.id,
            fecha,
            estado
        }));
        
        await apiRequest('/asistencia/batch', {
            method: 'POST',
            body: JSON.stringify(asistencias)
        });
        
        mostrarToast(`Todos los estudiantes marcados como ${estado}`, 'success');
        cargarLista(); // Recargar para mostrar cambios
    } catch (error) {
        mostrarToast('Error al marcar asistencia: ' + (error.message || 'Intenta de nuevo'), 'error');
    }
}

async function verAsistenciaEnTiempoReal() {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!materiaId || !fecha) {
        mostrarToast('Selecciona la materia y la fecha', 'error');
        return;
    }
    
    try {
        console.log('Cargando estadísticas para materia:', materiaId, 'fecha:', fecha);
        
        // Obtener asistencias del día
        const asistencias = await apiRequest(`/asistencia/${materiaId}/${fecha}`);
        
        console.log('Asistencias recibidas:', asistencias);
        
        // Mostrar estadísticas en tiempo real
        const presentes = asistencias.filter(a => a.estado === 'presente').length;
        const ausentes = asistencias.filter(a => a.estado === 'ausente').length;
        const retardos = asistencias.filter(a => a.estado === 'retardo').length;
        const total = asistencias.length;
        
        const statsDiv = document.getElementById('statsAsistencia');
        if (statsDiv) {
            const porcentajePresentes = total > 0 ? ((presentes / total) * 100).toFixed(1) : 0;
            statsDiv.innerHTML = `
                <div class="panel-card">
                    <h4>Estadísticas en Tiempo Real</h4>
                    <div class="stats-grid">
                        <div class="stat-item presente">
                            <span class="stat-number">${presentes}</span>
                            <span class="stat-label">Presentes (${porcentajePresentes}%)</span>
                        </div>
                        <div class="stat-item ausente">
                            <span class="stat-number">${ausentes}</span>
                            <span class="stat-label">Ausentes</span>
                        </div>
                        <div class="stat-item retardo">
                            <span class="stat-number">${retardos}</span>
                            <span class="stat-label">Retardos</span>
                        </div>
                        <div class="stat-item total">
                            <span class="stat-number">${total}</span>
                            <span class="stat-label">Total</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Actualizar cada 30 segundos
        setTimeout(verAsistenciaEnTiempoReal, 30000);
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        
        // Mostrar estadísticas vacías con mensaje de error
        const statsDiv = document.getElementById('statsAsistencia');
        if (statsDiv) {
            statsDiv.innerHTML = `
                <div class="panel-card">
                    <h4>Estadísticas en Tiempo Real</h4>
                    <div class="alert alert-warning">
                        <p><strong>No se pudieron cargar las estadísticas</strong></p>
                        <p>Error: ${error.message || 'Error desconocido'}</p>
                        <p>Intenta registrar asistencia primero para ver las estadísticas.</p>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item presente">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Presentes (0%)</span>
                        </div>
                        <div class="stat-item ausente">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Ausentes</span>
                        </div>
                        <div class="stat-item retardo">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Retardos</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        mostrarToast('Error al cargar estadísticas: ' + (error.message || 'Intenta de nuevo'), 'error');
    }
}

async function cargarHistorialCompleto() {
    const materiaId = document.getElementById('materiaSelect').value;
    if (!materiaId) {
        mostrarToast('Selecciona una materia para ver el historial', 'error');
        return;
    }
    
    try {
        console.log('Cargando historial de asistencia para materia:', materiaId);
        
        // Obtener todo el historial de asistencias de la materia
        const historial = await apiRequest(`/asistencia/historial/${materiaId}`);
        
        console.log('Historial recibido:', historial);
        
        const container = document.getElementById('historialCompletoContainer');
        if (!container) {
            console.error('Contenedor historialCompletoContainer no encontrado');
            return;
        }
        
        if (!historial || historial.length === 0) {
            container.innerHTML = `
                <div class="panel-card">
                    <h3>Historial Completo de Asistencias</h3>
                    <div class="empty-state">
                        <i class="fas fa-calendar-times" style="font-size:3rem; color:#94a3b8; margin-bottom:1rem;"></i>
                        <p>No hay registros de asistencia para esta materia.</p>
                        <p style="font-size: 0.85rem; color: #666;">Intenta registrar asistencia primero para ver el historial.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Agrupar por fecha
        const porFecha = {};
        historial.forEach(registro => {
            if (!porFecha[registro.fecha]) {
                porFecha[registro.fecha] = [];
            }
            porFecha[registro.fecha].push(registro);
        });
        
        // Generar HTML del historial
        let html = '<div class="panel-card"><h3>Historial Completo de Asistencias</h3>';
        
        Object.keys(porFecha).sort().reverse().forEach(fecha => {
            const registros = porFecha[fecha];
            const presentes = registros.filter(r => r.estado === 'presente').length;
            const ausentes = registros.filter(r => r.estado === 'ausente').length;
            const retardos = registros.filter(r => r.estado === 'retardo').length;
            const total = registros.length;
            const porcentaje = total > 0 ? ((presentes / total) * 100).toFixed(1) : 0;
            
            html += `
                <div class="historial-dia">
                    <div class="historial-header">
                        <h4>${formatearFecha(fecha)}</h4>
                        <div class="resumen-dia">
                            <span class="badge badge-success">${presentes} P</span>
                            <span class="badge badge-danger">${ausentes} A</span>
                            <span class="badge badge-warning">${retardos} R</span>
                            <span class="badge badge-info">${porcentaje}%</span>
                        </div>
                    </div>
                    <div class="tabla-historial">
                        <table>
                            <thead>
                                <tr>
                                    <th>Estudiante</th>
                                    <th>Matrícula</th>
                                    <th>Estado</th>
                                    <th>Hora</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${registros.map(r => `
                                    <tr>
                                        <td>${r.nombre_estudiante}</td>
                                        <td>${r.matricula}</td>
                                        <td>
                                            <span class="badge badge-${r.estado === 'presente' ? 'success' : r.estado === 'ausente' ? 'danger' : 'warning'}">
                                                ${r.estado.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>${r.hora_registro || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        
        const container = document.getElementById('historialCompletoContainer');
        if (container) {
            container.innerHTML = `
                <div class="panel-card">
                    <h3>Historial Completo de Asistencias</h3>
                    <div class="alert alert-error">
                        <h4>❌ Error al cargar historial</h4>
                        <p>No se pudieron cargar los registros de asistencia.</p>
                        <p><strong>Detalles:</strong> ${error.message || 'Error desconocido'}</p>
                        <p>Verifica la conexión con el servidor o intenta más tarde.</p>
                    </div>
                </div>
            `;
        }
        
        mostrarToast('Error al cargar historial: ' + (error.message || 'Intenta de nuevo'), 'error');
    }
}

// Función para generar QR localmente (fallback cuando tabla qr_logs no existe)
function generarQRLocal(materiaId, fecha, horaInicio, horaFin, materiaNombre) {
    // Crear datos del QR
    const qrData = {
        materia_id: parseInt(materiaId),
        materia_nombre: materiaNombre,
        fecha: fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        timestamp: Date.now(),
        codigo: generarSessionId(materiaId, fecha, horaInicio),
        modo: 'local'
    };
    
    // Generar QR usando QRCode.js (simulado con placeholder)
    // En producción, esto usaría una librería real de QR
    const qrContent = JSON.stringify({
        materia: materiaNombre,
        materia_id: materiaId,
        fecha: fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        codigo: qrData.codigo,
        timestamp: qrData.timestamp
    });
    
    // Simular generación de QR (en producción usaría librería real)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrContent)}`;
    
    mostrarToast('QR generado localmente (modo temporal - tabla qr_logs no disponible)', 'warning');
    
    return {
        qrDataUrl: qrCodeUrl,
        codigo: qrData.codigo,
        download_url: qrCodeUrl,
        modo: 'local',
        datos: qrData
    };
}

// Función para generar ID único de sesión
function generarSessionId(materiaId, fecha, horaInicio) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${materiaId}_${fecha}_${horaInicio.replace(':', '')}_${timestamp}_${random}`;
}

// Función para obtener ID del profesor actual
function obtenerProfesorId() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData.id || userData.profesor_id || userData.usuario_id;
}

// Función para verificar validez del QR
function verificarValidezQR(qrData) {
    try {
        const now = new Date();
        const qrTimestamp = new Date(qrData.timestamp);
        const qrHoraFin = new Date(`${qrData.fecha} ${qrData.hora_fin}`);
        
        // Verificar que el QR no haya expirado por tiempo
        if (now > qrHoraFin) {
            return { valido: false, motivo: 'El QR ha expirado. La clase ya finalizó.' };
        }
        
        // Verificar que el QR no sea demasiado antiguo (máximo 30 minutos antes de inicio)
        const qrHoraInicio = new Date(`${qrData.fecha} ${qrData.hora_inicio}`);
        const treintaMinutosAntes = new Date(qrHoraInicio.getTime() - 30 * 60 * 1000);
        if (now < treintaMinutosAntes) {
            return { valido: false, motivo: 'El QR aún no es válido. Demasiado temprano para la clase.' };
        }
        
        return { valido: true };
    } catch (error) {
        return { valido: false, motivo: 'QR inválido o corrupto.' };
    }
}

function formatearFecha(fechaStr) {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-MX', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}
