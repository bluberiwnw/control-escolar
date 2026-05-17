// Redondeo personalizado: .5 o menos baja, .6 o más sube
function redondearCalificacion(cal) {
    const parteEntera = Math.floor(cal);
    return (cal - parteEntera) >= 0.6 ? parteEntera + 1 : parteEntera;
}

// Normalizar calificación a escala 0-10 (100=10, 1=10, 0.8=8, etc.)
function normalizarCalificacion(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return 0;
    if (num > 10) return Math.min(num / 10, 10);
    if (num <= 1 && num > 0) return num * 10;
    return Math.min(num, 10);
}

let eventoChangeAgregado = false;
document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMaterias();
    await cargarHistorial();
    // No cargar alumnos automáticamente al inicio, esperar a que seleccione materia
});

async function cargarMaterias() {
    const materias = await apiRequest('/materias');
    const select = document.getElementById('materiaSelect');
    select.innerHTML = '<option value="">Seleccionar materia</option>' + materias.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
    
    // Agregar evento change para cargar ponderaciones cuando se seleccione una materia
    select.addEventListener('change', async () => {
        const materia_id = select.value;
        if (materia_id) {
            await cargarPonderaciones(materia_id);
            await cargarAlumnos();
        } else {
            // Limpiar campos de ponderación si no hay materia seleccionada
            document.getElementById('ponderacionTareas').value = 20;
            document.getElementById('ponderacionExamenes').value = 30;
            document.getElementById('ponderacionParticipacion').value = 10;
            document.getElementById('ponderacionProyectos').value = 20;
            document.getElementById('ponderacionPracticas').value = 20;
        }
    });
}
async function cargarPonderaciones(materia_id) {
    try {
        const ponderaciones = await apiRequest(`/calificaciones/ponderaciones/${materia_id}`);
        
        if (ponderaciones.tarea !== undefined) {
            document.getElementById('ponderacionTareas').value = ponderaciones.tarea;
        }
        if (ponderaciones.examen !== undefined) {
            document.getElementById('ponderacionExamenes').value = ponderaciones.examen;
        }
        if (ponderaciones.participacion !== undefined) {
            document.getElementById('ponderacionParticipacion').value = ponderaciones.participacion;
        }
        if (ponderaciones.proyecto !== undefined) {
            document.getElementById('ponderacionProyectos').value = ponderaciones.proyecto;
        }
        if (ponderaciones.practica !== undefined) {
            document.getElementById('ponderacionPracticas').value = ponderaciones.practica;
        }
        
        validarPonderaciones();
        console.log('✅ Ponderaciones cargadas para materia:', materia_id, ponderaciones);
    } catch (error) {
        console.log('No hay ponderaciones guardadas, usando valores por defecto');
        // Usar valores por defecto
        document.getElementById('ponderacionTareas').value = 20;
        document.getElementById('ponderacionExamenes').value = 30;
        document.getElementById('ponderacionParticipacion').value = 10;
        document.getElementById('ponderacionProyectos').value = 20;
        document.getElementById('ponderacionPracticas').value = 20;
        validarPonderaciones();
    }
}

async function subirArchivo(input) {
    const file = input.files[0];
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) { mostrarToast('Selecciona una materia', 'error'); return; }
    if (!file) { mostrarToast('Selecciona un archivo', 'error'); return; }
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('materia_id', materia_id);
    const token = localStorage.getItem('token');
    const res = await fetch(`${window.API_URL}/calificaciones/upload`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
    });
    const data = await res.json();
    if (res.ok) {
        mostrarToast(data.message || 'Archivo HTM procesado', 'success');
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-success">${data.message}<br>${data.archivo?.detalles || ''}</div>`;
        cargarHistorial();
        await cargarAlumnos();
    } else {
        mostrarToast(data.message || 'Error al subir archivo', 'error');
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-error">${data.message || 'Error al subir archivo'}</div>`;
    }
}

async function descargarPlantilla() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/calificaciones/plantilla`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!res.ok) {
            throw new Error('Error al descargar plantilla');
        }
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla_calificaciones.htm';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        mostrarToast('Plantilla HTM descargada correctamente', 'success');
    } catch (error) {
        mostrarToast(error.message || 'Error al descargar plantilla', 'error');
    }
}

async function cargarHistorial() {
    const archivos = await apiRequest('/calificaciones/archivos');
    if (!archivos.length) {
        document.getElementById('archivosList').innerHTML = '<div class="empty-state">No hay documentos cargados.</div>';
        return;
    }
    document.getElementById('archivosList').innerHTML = archivos
        .map(
            (a) => `<div class="archivo-item">
            <div>
                <strong>${a.nombre_archivo}</strong><br>
                <small>${a.tipo} - ${new Date(a.fecha_subida).toLocaleDateString()}</small>
            </div>
            <div class="table-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-auth-download="/calificaciones/archivos/${a.id}/descarga">Descargar</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="eliminarArchivo(${a.id})">Eliminar</button>
                <span class="badge">${a.estado}</span>
            </div>
        </div>`
        )
        .join('');
}

async function eliminarArchivo(id) {
    if (!window.confirm('Eliminar archivo?')) return;
    await apiRequest(`/calificaciones/archivos/${id}`, { method: 'DELETE' });
    mostrarToast('Archivo eliminado', 'success');
    await cargarHistorial();
}

async function previsualizarArchivo(input) {
    const file = input.files[0];
    if (!file) return;

    const validExt = ['.htm', '.html'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExt.includes(ext)) {
        document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">Solo se permiten archivos HTM/HTML (.htm, .html).</div>';
        return;
    }
    window.tempFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        const tables = doc.querySelectorAll('table');
        if (tables.length === 0) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">No se encontraron tablas en el archivo HTML.</div>';
            return;
        }
        
        let targetTable = null;
        for (const table of tables) {
            const caption = table.querySelector('caption');
            if (caption && caption.textContent.includes('Resumen de Lista de Clase')) {
                targetTable = table;
                break;
            }
        }
        
        if (!targetTable) {
            for (const table of tables) {
                const rows = table.querySelectorAll('tr');
                if (rows.length > 5) {
                    targetTable = table;
                    break;
                }
            }
        }
        
        if (!targetTable) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">No se encontró la tabla de alumnos en el archivo HTML.</div>';
            return;
        }
        
        const table = targetTable;
        const rows = table.querySelectorAll('tr');
        
        if (rows.length <= 1) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">La tabla no contiene datos.</div>';
            return;
        }
        
        const headerRow = rows[0];
        const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
        
        // Identificar columnas vacías/dddead para excluirlas
        const skipColumns = new Set();
        headerCells.forEach((cell, index) => {
            const cls = cell.className || '';
            const text = cell.textContent.trim();
            if (cls.includes('dddead') || (!text && !cell.querySelector('a'))) {
                skipColumns.add(index);
            }
        });
        
        // Columnas base conocidas del HTM BUAP
        const knownColumns = ['Número de Registro', 'Nombre de Alumno', 'ID', 'Status de Inscripción', 'Nivel', 'Créditos', 'Email'];
        const displayColumns = ['Número de Registro', 'Nombre de Alumno', 'ID', 'Nivel', 'Créditos', 'Email'];
        
        // Detectar columnas extra con datos numéricos (posibles calificaciones)
        const extraColumns = [];
        headerCells.forEach((cell, index) => {
            if (skipColumns.has(index)) return;
            const header = cell.textContent.trim();
            const mapped = mapHeader(header);
            if (mapped && !knownColumns.includes(mapped)) {
                extraColumns.push({ index, originalHeader: header });
            }
        });
        
        function mapHeader(header) {
            if (!header) return null;
            if (header.includes('Número de Registro') || header.includes('Registro')) return 'Número de Registro';
            if (header.includes('Nombre de Alumno') || header.includes('Nombre')) return 'Nombre de Alumno';
            if (header.includes('ID') || header.includes('Identificación')) return 'ID';
            if (header.includes('Status de Inscripción') || header.includes('Status')) return 'Status de Inscripción';
            if (header.includes('Nivel')) return 'Nivel';
            if (header.includes('Créditos')) return 'Créditos';
            if (header.includes('Detalle de Calificaciones') || header.includes('Calificaciones')) return 'Email';
            return header.trim() || null;
        }
        
        // Verificar si las columnas extra tienen datos numéricos (calificaciones)
        const firstDataRow = rows[1] ? Array.from(rows[1].querySelectorAll('td')) : [];
        const extraColumnsWithData = extraColumns.filter(col => {
            const cellText = firstDataRow[col.index]?.textContent.trim() || '';
            const num = parseFloat(cellText);
            return !isNaN(num) && cellText.length > 0;
        });
        
        const dataRows = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = Array.from(row.querySelectorAll('td'));
            
            if (cells.length < 3) continue;
            
            // Verificar que no sea una fila dddead completa
            const allDead = cells.every(c => (c.className || '').includes('dddead') || !c.textContent.trim());
            if (allDead) continue;
            
            const rowData = {};
            
            rowData['Número de Registro'] = cells[0]?.textContent.trim() || '';
            
            const nombreSpan = cells[1]?.querySelector('.fieldmediumtext');
            const nombreAlumno = nombreSpan?.textContent.trim() || cells[1]?.textContent.trim() || '';
            rowData['Nombre de Alumno'] = nombreAlumno;
            
            const idSpan = cells[2]?.querySelector('.fieldmediumtext');
            const idAlumno = idSpan?.textContent.trim() || cells[2]?.textContent.trim() || '';
            rowData['ID'] = idAlumno;
            
            const nivelSpan = cells[4]?.querySelector('.fieldmediumtext');
            rowData['Nivel'] = nivelSpan?.textContent.trim() || cells[4]?.textContent.trim() || '';
            
            const creditosSpan = cells[5]?.querySelector('.fieldmediumtext');
            rowData['Créditos'] = creditosSpan?.textContent.trim() || cells[5]?.textContent.trim() || '';
            
            // Extraer email desde enlace mailto
            let email = '';
            for (let j = 0; j < cells.length; j++) {
                const emailLink = cells[j]?.querySelector('a[href^="mailto:"]');
                if (emailLink) {
                    email = emailLink.getAttribute('href').replace('mailto:', '');
                    break;
                }
            }
            rowData['Email'] = email;
            rowData['Matrícula'] = idAlumno;
            rowData['Nombre'] = nombreAlumno;
            
            // Extraer datos de columnas extra
            extraColumnsWithData.forEach(col => {
                const val = cells[col.index]?.textContent.trim() || '0';
                rowData[`extra_${col.index}`] = parseFloat(val) || 0;
            });
            
            // Calificaciones por defecto en 0
            rowData['Tareas'] = 0;
            rowData['Exámenes'] = 0;
            rowData['Participación'] = 0;
            rowData['Proyectos'] = 0;
            rowData['Prácticas'] = 0;
            
            if (idAlumno || nombreAlumno) {
                dataRows.push(rowData);
            }
        }
        
        if (dataRows.length === 0) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">No se encontraron datos válidos en la tabla.</div>';
            return;
        }
        
        // Mapeo de columnas extra a campos de calificación
        const camposCalificacion = ['-- No asociar --', 'Tareas', 'Exámenes', 'Participación', 'Proyectos', 'Prácticas'];
        
        let mappingHtml = '';
        if (extraColumnsWithData.length > 0) {
            mappingHtml = `<div class="alert alert-info" style="margin-bottom: 15px;">
                <strong>Se detectaron ${extraColumnsWithData.length} columna(s) con datos numéricos adicionales.</strong><br>
                Puedes asociar cada columna a un campo de calificación:
                <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 10px;">`;
            extraColumnsWithData.forEach(col => {
                mappingHtml += `<div style="display: flex; align-items: center; gap: 5px;">
                    <label>"${col.originalHeader}":</label>
                    <select id="mapCol_${col.index}" class="extra-col-mapping" data-col-index="${col.index}" style="padding: 4px 8px;">
                        ${camposCalificacion.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>`;
            });
            mappingHtml += `</div>
                <button type="button" class="btn btn-primary btn-sm" style="margin-top: 10px;" onclick="aplicarMapeoColumnas()">Aplicar asociación</button>
            </div>`;
        }
        
        const calificacionesHeaders = ['Tareas', 'Exámenes', 'Participación', 'Proyectos', 'Prácticas'];
        const previewHeaders = [...displayColumns, ...calificacionesHeaders];
        
        let html = mappingHtml + `<h4>Vista previa (primeros 10 registros)</h4>
                    <table class="asistencia-tabla">
                        <thead><tr>${previewHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                        <tbody>`;
        
        dataRows.slice(0, 10).forEach(row => {
            html += '<tr>';
            previewHeaders.forEach(header => {
                if (calificacionesHeaders.includes(header)) {
                    const val = row[header] || 0;
                    html += `<td><input type="number" value="${parseFloat(val).toFixed(1)}" min="0" max="10" step="0.1" disabled style="width: 80px;"></td>`;
                } else {
                    html += `<td>${row[header] || ''}</td>`;
                }
            });
            html += '</tr>';
        });
        
        html += `</tbody></table>
                   <div class="alert alert-info">
                       <strong>Se encontraron ${dataRows.length} estudiantes en el archivo.</strong><br>
                       Los alumnos serán importados con calificaciones iniciales en 0. Podrás editar las calificaciones después de procesar el archivo.
                   </div>
                   <div style="margin-top: 15px; display: flex; gap: 10px;">
                       <button class="btn-login-buap" onclick="confirmarSubida()">
                           <i class="fas fa-upload"></i> Procesar Archivo
                       </button>
                       <button class="btn-secondary" onclick="cancelarProcesoHTM()">
                           <i class="fas fa-times"></i> Cancelar
                       </button>
                   </div>`;
        
        window.processedData = {
            headers: displayColumns,
            rows: dataRows,
            extraColumnsWithData: extraColumnsWithData
        };
        
        document.getElementById('previewTable').innerHTML = html;
        console.log('📊 Datos procesados:', window.processedData);
    };
    
    reader.readAsText(file);
}

function aplicarMapeoColumnas() {
    if (!window.processedData) return;
    
    const mappings = document.querySelectorAll('.extra-col-mapping');
    const campoMap = {};
    
    mappings.forEach(select => {
        const colIndex = parseInt(select.dataset.colIndex);
        const campo = select.value;
        if (campo !== '-- No asociar --') {
            campoMap[colIndex] = campo;
        }
    });
    
    // Aplicar mapeo a los datos procesados
    window.processedData.rows.forEach(row => {
        Object.entries(campoMap).forEach(([colIndex, campo]) => {
            const val = row[`extra_${colIndex}`] || 0;
            row[campo] = val;
        });
    });
    
    // Guardar mapeo para usarlo al enviar
    window.processedData.columnMapping = campoMap;
    
    // Regenerar la tabla de preview con los valores actualizados
    const calificacionesHeaders = ['Tareas', 'Exámenes', 'Participación', 'Proyectos', 'Prácticas'];
    const displayColumns = ['Número de Registro', 'Nombre de Alumno', 'ID', 'Nivel', 'Créditos', 'Email'];
    const previewHeaders = [...displayColumns, ...calificacionesHeaders];
    
    const tableEl = document.querySelector('#previewTable .asistencia-tabla');
    if (tableEl) {
        const tbody = tableEl.querySelector('tbody');
        tbody.innerHTML = '';
        window.processedData.rows.slice(0, 10).forEach(row => {
            let rowHtml = '<tr>';
            previewHeaders.forEach(header => {
                if (calificacionesHeaders.includes(header)) {
                    const val = row[header] || 0;
                    rowHtml += `<td><input type="number" value="${parseFloat(val).toFixed(1)}" min="0" max="10" step="0.1" disabled style="width: 80px;"></td>`;
                } else {
                    rowHtml += `<td>${row[header] || ''}</td>`;
                }
            });
            rowHtml += '</tr>';
            tbody.innerHTML += rowHtml;
        });
    }
    
    mostrarToast('Columnas asociadas correctamente', 'success');
}

async function confirmarSubida() {
    if (!window.tempFile || !window.processedData) {
        mostrarToast('No hay archivo para procesar', 'error');
        return;
    }
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        mostrarToast('Seleccione una materia', 'error');
        return;
    }

    // Auto-aplicar mapeo de columnas extra antes de enviar
    const mappings = document.querySelectorAll('.extra-col-mapping');
    if (mappings.length > 0) {
        const campoMap = {};
        mappings.forEach(select => {
            const colIndex = parseInt(select.dataset.colIndex);
            const campo = select.value;
            if (campo !== '-- No asociar --') {
                campoMap[colIndex] = campo;
            }
        });
        
        if (Object.keys(campoMap).length > 0) {
            window.processedData.rows.forEach(row => {
                Object.entries(campoMap).forEach(([colIndex, campo]) => {
                    const val = row[`extra_${colIndex}`] || 0;
                    row[campo] = val;
                });
            });
        }
    }

    // Enviar los datos procesados en lugar del archivo original
    const payload = {
        materia_id: materia_id,
        estudiantes: window.processedData.rows,
        archivo_original: window.tempFile.name
    };

    console.log('📤 Enviando datos procesados:', payload);
    console.log('📤 Calificaciones del primer estudiante:', {
        Tareas: payload.estudiantes[0]?.Tareas,
        Exámenes: payload.estudiantes[0]?.['Exámenes'],
        Participación: payload.estudiantes[0]?.['Participación'],
        Proyectos: payload.estudiantes[0]?.Proyectos,
        Prácticas: payload.estudiantes[0]?.['Prácticas']
    });

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/calificaciones/procesar-datos`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-success">${data.message}<br>${data.archivo?.detalles || ''}</div>`;
            cargarHistorial();
            await cargarAlumnos();
            document.getElementById('previewTable').innerHTML = '';
            window.tempFile = null;
            document.getElementById('fileInput').value = '';
            mostrarToast('Archivo HTM procesado correctamente', 'success');
        } else {
            console.error('❌ Error del servidor:', data);
            document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-error">${data.message || 'Error al procesar archivo HTM'}</div>`;
            mostrarToast(data.message || 'Error al procesar archivo', 'error');
        }
    } catch (error) {
        console.error('❌ Error al enviar datos:', error);
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-error">Error de conexión al procesar el archivo: ${error.message}</div>`;
        mostrarToast('Error de conexión al procesar archivo', 'error');
    }
}

async function cargarAlumnos() {
    const materia_id = document.getElementById('materiaSelect').value;
    console.log('🔄 cargarAlumnos - materia_id:', materia_id);
    console.log('🔄 cargarAlumnos - materiaSelect value:', document.getElementById('materiaSelect').value);
    
    if (!materia_id) {
        document.getElementById('alumnosTable').innerHTML = '<div class="alert alert-info">Selecciona una materia para ver los alumnos.</div>';
        return;
    }

    try {
        console.log('🔄 cargarAlumnos - Solicitando alumnos para materia:', materia_id);
        const alumnos = await apiRequest(`/calificaciones/materia/${materia_id}/alumnos`);
        console.log('🔄 cargarAlumnos - Alumnos recibidos:', alumnos);
        
        let html = `
            <div class="panel-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>Alumnos de la Materia</h3>
                    <button type="button" class="btn btn-primary" onclick="abrirModalAlumno()">
                        <i class="fas fa-plus"></i> Agregar Alumno
                    </button>
                </div>
                
                ${alumnos.length === 0 ? `
                    <div class="alert alert-info" style="margin-bottom: 1rem;">
                        <i class="fas fa-info-circle"></i>
                        No hay alumnos registrados en esta materia. Puedes agregar alumnos manualmente o subir un archivo HTM con las calificaciones.
                    </div>
                ` : ''}
                
                <div class="table-responsive-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Matrícula</th>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Tareas</th>
                                <th>Exámenes</th>
                                <th>Participación</th>
                                <th>Proyectos</th>
                                <th>Prácticas</th>
                                <th>Calificación</th>
                                <th>Calificación Final</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (alumnos.length === 0) {
            html += `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 2rem; color: #64748b;">
                        <i class="fas fa-user-plus" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                        <div>Usa el botón "Agregar Alumno" para comenzar a registrar calificaciones</div>
                    </td>
                </tr>
            `;
        } else {
            console.log('🔄 cargarAlumnos - Procesando alumnos:', alumnos.length);
            alumnos.forEach((alumno, index) => {
                console.log(`🔄 cargarAlumnos - Procesando alumno ${index + 1}:`, alumno);
                const calRedondeada = alumno.calificacion_redondeada != null ? alumno.calificacion_redondeada : (alumno.calificacion_final != null ? redondearCalificacion(alumno.calificacion_final) : 0);
                const calFinal = alumno.calificacion_final != null ? alumno.calificacion_final : 0;
                const calificacionColor = calRedondeada >= 9 ? 'success' : 
                                        calRedondeada >= 7 ? 'warning' : 'danger';
                
                html += `
                    <tr>
                        <td>${alumno.matricula}</td>
                        <td>${alumno.nombre}</td>
                        <td>${alumno.email || 'N/A'}</td>
                        <td>
                            <input type="number" 
                                   class="calificacion-input" 
                                   id="tarea_${alumno.id}" 
                                   value="${alumno.tarea || 0}" 
                                   min="0" 
                                   max="10" 
                                   step="0.1"
                                   onchange="actualizarCalificacion(${alumno.id}, 'tarea', this.value)">
                        </td>
                        <td>
                            <input type="number" 
                                   class="calificacion-input" 
                                   id="examen_${alumno.id}" 
                                   value="${alumno.examen || 0}" 
                                   min="0" 
                                   max="10" 
                                   step="0.1"
                                   onchange="actualizarCalificacion(${alumno.id}, 'examen', this.value)">
                        </td>
                        <td>
                            <input type="number" 
                                   class="calificacion-input" 
                                   id="participacion_${alumno.id}" 
                                   value="${alumno.participacion || 0}" 
                                   min="0" 
                                   max="10" 
                                   step="0.1"
                                   onchange="actualizarCalificacion(${alumno.id}, 'participacion', this.value)">
                        </td>
                        <td>
                            <input type="number" 
                                   class="calificacion-input" 
                                   id="proyecto_${alumno.id}" 
                                   value="${alumno.proyecto || 0}" 
                                   min="0" 
                                   max="10" 
                                   step="0.1"
                                   onchange="actualizarCalificacion(${alumno.id}, 'proyecto', this.value)">
                        </td>
                        <td>
                            <input type="number" 
                                   class="calificacion-input" 
                                   id="practica_${alumno.id}" 
                                   value="${alumno.practica || 0}" 
                                   min="0" 
                                   max="10" 
                                   step="0.1"
                                   onchange="actualizarCalificacion(${alumno.id}, 'practica', this.value)">
                        </td>
                        <td>
                            <span id="final_${alumno.id}">${calFinal}</span>
                        </td>
                        <td>
                            <span class="badge badge-${calificacionColor}" id="redondeada_${alumno.id}">${calRedondeada}</span>
                        </td>
                        <td>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="editarAlumno(${alumno.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="eliminarAlumno(${alumno.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        console.log('🔄 cargarAlumnos - HTML generado:', html.length, 'caracteres');
        document.getElementById('alumnosTable').innerHTML = html;
        console.log('✅ cargarAlumnos - HTML actualizado en DOM');
    } catch (error) {
        console.error('Error al cargar alumnos:', error);
        document.getElementById('alumnosTable').innerHTML = '<div class="alert alert-error">Error al cargar alumnos.</div>';
    }
}

function abrirModalAlumno(alumnoId = null) {
    console.log('🔓 Abriendo modal alumno:', alumnoId);
    
    if (alumnoId) {
        editarAlumno(alumnoId);
    } else {
        document.getElementById('modalAlumnoTitulo').textContent = 'Agregar Alumno';
        document.getElementById('alumnoIdEdit').value = '';
        document.getElementById('alumnoMatricula').value = '';
        document.getElementById('alumnoNombre').value = '';
        document.getElementById('alumnoEmail').value = '';
        document.getElementById('modalAlumno').style.display = 'flex';
        console.log('✅ Modal para agregar alumno abierto');
    }
}

async function editarAlumno(alumnoId) {
    try {
        const materia_id = document.getElementById('materiaSelect').value;
        const alumnos = await apiRequest(`/calificaciones/materia/${materia_id}/alumnos`);
        const alumno = alumnos.find(a => a.id === alumnoId);
        
        if (!alumno) {
            mostrarToast('Alumno no encontrado', 'error');
            return;
        }

        document.getElementById('modalAlumnoTitulo').textContent = 'Editar Alumno';
        document.getElementById('alumnoIdEdit').value = alumno.id;
        document.getElementById('alumnoMatricula').value = alumno.matricula;
        document.getElementById('alumnoNombre').value = alumno.nombre;
        document.getElementById('alumnoEmail').value = alumno.email || '';
        document.getElementById('modalAlumno').style.display = 'flex';
    } catch (error) {
        mostrarToast('Error al cargar datos del alumno', 'error');
    }
}

async function guardarAlumno(event) {
    event.preventDefault();
    
    const alumnoId = document.getElementById('alumnoIdEdit').value;
    const materia_id = document.getElementById('materiaSelect').value;
    const matricula = document.getElementById('alumnoMatricula').value.trim();
    const nombre = document.getElementById('alumnoNombre').value.trim();
    const email = document.getElementById('alumnoEmail').value.trim();

    console.log('🔍 guardarAlumno - Datos del formulario:', {
        alumnoId,
        materia_id,
        matricula,
        nombre,
        email
    });

    if (!materia_id || !matricula || !nombre) {
        mostrarToast('Completa los campos obligatorios', 'error');
        console.log('❌ Validación fallida:', { materia_id, matricula, nombre });
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        mostrarToast('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
        window.location.href = '/login.html';
        return;
    }

    try {
        const data = { materia_id, matricula, nombre, email };
        
        if (alumnoId) {
            await apiRequest(`/calificaciones/alumnos/${alumnoId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            mostrarToast('Alumno actualizado', 'success');
        } else {
            const response = await apiRequest('/calificaciones/alumnos', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            console.log('✅ Alumno creado exitosamente:', response);
            
            if (response.ya_inscrito) {
                mostrarToast(response.message, 'warning');
            } else {
                mostrarToast('Alumno creado', 'success');
            }
        }
        
        document.getElementById('alumnoIdEdit').value = '';
        document.getElementById('alumnoMatricula').value = '';
        document.getElementById('alumnoNombre').value = '';
        document.getElementById('alumnoEmail').value = '';
        document.getElementById('modalAlumno').style.display = 'none';
        
        console.log('🔄 Refrescando lista de alumnos...');
        await cargarAlumnos();
        console.log('✅ Lista de alumnos refrescada');
        
    } catch (error) {
        mostrarToast(error.message || 'No se pudo guardar el alumno', 'error');
    }
}

async function eliminarAlumno(alumnoId) {
    if (!confirm('¿Estás seguro de eliminar este alumno de esta materia? Esta acción no se puede deshacer.')) {
        return;
    }

    const materia_id = document.getElementById('materiaSelect').value;

    try {
        await apiRequest(`/calificaciones/alumnos/${alumnoId}${materia_id ? '?materia_id=' + materia_id : ''}`, {
            method: 'DELETE'
        });
        mostrarToast('Alumno eliminado', 'success');
        await cargarAlumnos();
    } catch (error) {
        mostrarToast(error.message || 'No se pudo eliminar el alumno', 'error');
    }
}

function validarPonderaciones() {
    const tareas = parseFloat(document.getElementById('ponderacionTareas').value) || 0;
    const examenes = parseFloat(document.getElementById('ponderacionExamenes').value) || 0;
    const participacion = parseFloat(document.getElementById('ponderacionParticipacion').value) || 0;
    const proyectos = parseFloat(document.getElementById('ponderacionProyectos').value) || 0;
    const practicas = parseFloat(document.getElementById('ponderacionPracticas').value) || 0;
    
    const total = tareas + examenes + participacion + proyectos + practicas;
    document.getElementById('totalPonderacion').value = total;
    
    const mensajeDiv = document.getElementById('mensajePonderaciones');
    if (total === 100) {
        mensajeDiv.innerHTML = '<div class="alert alert-success">✅ Ponderaciones correctas</div>';
        return true;
    } else {
        mensajeDiv.innerHTML = `<div class="alert alert-error">❌ El total debe ser 100%. Actual: ${total}%</div>`;
        return false;
    }
}

async function guardarPonderaciones() {
    if (!validarPonderaciones()) {
        mostrarToast('Corrige las ponderaciones antes de guardar', 'error');
        return;
    }
    
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        mostrarToast('Selecciona una materia primero', 'error');
        return;
    }
    
    const ponderaciones = {
        tarea: parseFloat(document.getElementById('ponderacionTareas').value) || 20,
        examen: parseFloat(document.getElementById('ponderacionExamenes').value) || 30,
        participacion: parseFloat(document.getElementById('ponderacionParticipacion').value) || 10,
        proyecto: parseFloat(document.getElementById('ponderacionProyectos').value) || 20,
        practica: parseFloat(document.getElementById('ponderacionPracticas').value) || 20
    };
    
    try {
        const resultado = await apiRequest('/calificaciones/ponderaciones', {
            method: 'POST',
            body: JSON.stringify({
                materia_id: materia_id,
                ponderaciones: ponderaciones
            })
        });
        
        mostrarToast(`Ponderaciones guardadas y calificaciones recalculadas (${resultado.alumnos_actualizados || 0} alumnos)`, 'success');
    } catch (error) {
        console.error('Error al guardar ponderaciones:', error);
        mostrarToast(error.message || 'Error al guardar ponderaciones', 'error');
    }
    
    // Recargar alumnos para mostrar las calificaciones actualizadas
    try {
        await cargarAlumnos();
    } catch (e) {
        console.error('Error al recargar alumnos:', e);
    }
}

async function calcularCalificaciones() {
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        mostrarToast('Selecciona una materia primero', 'error');
        return;
    }
    
    if (!validarPonderaciones()) {
        mostrarToast('Corrige las ponderaciones antes de calcular', 'error');
        return;
    }
    
    try {
        mostrarToast('Calculando calificaciones...', 'info');
        
        const ponderaciones = {
            tarea: parseFloat(document.getElementById('ponderacionTareas').value) || 0,
            examen: parseFloat(document.getElementById('ponderacionExamenes').value) || 0,
            participacion: parseFloat(document.getElementById('ponderacionParticipacion').value) || 0,
            proyecto: parseFloat(document.getElementById('ponderacionProyectos').value) || 0,
            practica: parseFloat(document.getElementById('ponderacionPracticas').value) || 0
        };
        
        const resultado = await apiRequest(`/calificaciones/calcular/${materia_id}`, {
            method: 'POST',
            body: JSON.stringify(ponderaciones)
        });
        
        mostrarToast(`Calificaciones calculadas para ${resultado.calculados} alumnos`, 'success');
        
        await cargarAlumnos();
        
    } catch (error) {
        mostrarToast(error.message || 'Error al calcular calificaciones', 'error');
    }
}

async function actualizarCalificacion(estudianteId, tipo, valor) {
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        mostrarToast('Selecciona una materia primero', 'error');
        return;
    }
    
    try {
        const data = {
            estudiante_id: estudianteId,
            materia_id: materia_id,
            tipo: tipo,
            calificacion: normalizarCalificacion(valor)
        };
        
        await apiRequest('/calificaciones/actualizar', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        await recalcularCalificacionFinal(estudianteId, materia_id);
        
        mostrarToast('Calificación actualizada', 'success');
    } catch (error) {
        mostrarToast(error.message || 'Error al actualizar calificación', 'error');
        document.getElementById(`${tipo}_${estudianteId}`).value = valor;
    }
}

async function recalcularCalificacionFinal(estudianteId, materia_id) {
    try {
        const tareaElement = document.getElementById(`tarea_${estudianteId}`);
        const examenElement = document.getElementById(`examen_${estudianteId}`);
        const participacionElement = document.getElementById(`participacion_${estudianteId}`);
        const proyectoElement = document.getElementById(`proyecto_${estudianteId}`);
        const practicaElement = document.getElementById(`practica_${estudianteId}`);
        
        const tarea = normalizarCalificacion((tareaElement && tareaElement.value) ? tareaElement.value : 0);
        const examen = normalizarCalificacion((examenElement && examenElement.value) ? examenElement.value : 0);
        const participacion = normalizarCalificacion((participacionElement && participacionElement.value) ? participacionElement.value : 0);
        const proyecto = normalizarCalificacion((proyectoElement && proyectoElement.value) ? proyectoElement.value : 0);
        const practica = normalizarCalificacion((practicaElement && practicaElement.value) ? practicaElement.value : 0);
        
        const pesoTarea = (parseFloat(document.getElementById('ponderacionTareas').value) || 20) / 100;
        const pesoExamen = (parseFloat(document.getElementById('ponderacionExamenes').value) || 30) / 100;
        const pesoParticipacion = (parseFloat(document.getElementById('ponderacionParticipacion').value) || 10) / 100;
        const pesoProyecto = (parseFloat(document.getElementById('ponderacionProyectos').value) || 20) / 100;
        const pesoPractica = (parseFloat(document.getElementById('ponderacionPracticas').value) || 20) / 100;
        
        const calificacionFinal = (
            (proyecto * pesoProyecto) +      
            (examen * pesoExamen) +        
            (participacion * pesoParticipacion) +   
            (tarea * pesoTarea) +          
            (practica * pesoPractica)          
        );
        
        const calFinalSinRedondeo = Math.max(0, Math.min(10, calificacionFinal));
        const calFinalRedondeada = redondearCalificacion(calFinalSinRedondeo);
        
        // Actualizar columna "Calificación" (redondeada)
        const redondeadaElement = document.getElementById(`redondeada_${estudianteId}`);
        if (redondeadaElement) {
            redondeadaElement.textContent = calFinalRedondeada;
            
            let colorClass = 'badge-danger';
            if (calFinalRedondeada >= 9) colorClass = 'badge-success';
            else if (calFinalRedondeada >= 8) colorClass = 'badge-primary';
            else if (calFinalRedondeada >= 7) colorClass = 'badge-warning';
            else if (calFinalRedondeada >= 6) colorClass = 'badge-info';
            
            redondeadaElement.className = `badge ${colorClass}`;
        }
        
        // Actualizar columna "Calificación Final" (sin redondeo)
        const finalElement = document.getElementById(`final_${estudianteId}`);
        if (finalElement) {
            finalElement.textContent = calFinalSinRedondeo.toFixed(2);
        }
        
        console.log(`Calificación recalculada: sin redondeo=${calFinalSinRedondeo.toFixed(2)}, redondeada=${calFinalRedondeada}`);
        
    } catch (error) {
        console.error('Error al recalcular calificación final:', error);
    }
}

function cerrarModalAlumno() {
    document.getElementById('modalAlumno').style.display = 'none';
}

async function cancelarCambios() {
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        mostrarToast('Selecciona una materia', 'error');
        return;
    }

    if (!confirm('¿Estás seguro de cancelar todos los cambios no guardados? Se recargarán los datos desde el servidor.')) {
        return;
    }

    try {
        mostrarToast('Recargando datos...', 'info');
        
        await cargarAlumnos();
        
        mostrarToast('Cambios cancelados. Datos recargados desde el servidor.', 'success');
        
    } catch (error) {
        mostrarToast(error.message || 'Error al cancelar cambios', 'error');
    }
}

async function exportarExcel() {
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        mostrarToast('Selecciona una materia', 'error');
        return;
    }

    try {
        // Obtener nombre de la materia
        const materiaSelect = document.getElementById('materiaSelect');
        const nombreMateria = materiaSelect.options[materiaSelect.selectedIndex].text || 'Materia';

        // Obtener ponderaciones actuales
        const pTarea = parseFloat(document.getElementById('ponderacionTareas').value) || 0;
        const pExamen = parseFloat(document.getElementById('ponderacionExamenes').value) || 0;
        const pParticipacion = parseFloat(document.getElementById('ponderacionParticipacion').value) || 0;
        const pProyecto = parseFloat(document.getElementById('ponderacionProyectos').value) || 0;
        const pPractica = parseFloat(document.getElementById('ponderacionPracticas').value) || 0;

        // Obtener datos de alumnos (HTM procesado o BD)
        let alumnos;
        if (window.processedData && window.processedData.rows && window.processedData.rows.length > 0) {
            alumnos = window.processedData.rows;
            console.log('📊 Exportando datos del HTM:', alumnos.length, 'estudiantes');
        } else {
            alumnos = await apiRequest(`/calificaciones/materia/${materia_id}/alumnos`);
            console.log('📊 Exportando datos de la BD:', alumnos.length, 'estudiantes');
        }

        if (!alumnos || !Array.isArray(alumnos) || alumnos.length === 0) {
            mostrarToast('No hay datos para exportar', 'error');
            return;
        }

        // Construir hoja de calificaciones con TODA la info del alumno
        const headerRow = [
            'No.', 'Número de Registro', 'Matrícula', 'Nombre Completo',
            'Status de Inscripción', 'Nivel', 'Créditos', 'Email',
            `Tareas (${pTarea}%)`, `Exámenes (${pExamen}%)`,
            `Participación (${pParticipacion}%)`, `Proyectos (${pProyecto}%)`,
            `Prácticas (${pPractica}%)`, 'Calificación', 'Calificación Final'
        ];

        const wsData = [];

        // Info de materia
        wsData.push(['Materia:', nombreMateria]);
        wsData.push(['Fecha de exportación:', new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })]);
        wsData.push([]);

        // Fila de ponderaciones (alineada con las columnas de calificaciones)
        wsData.push(['', '', '', '', '', '', '', 'Ponderación:', `${pTarea}%`, `${pExamen}%`, `${pParticipacion}%`, `${pProyecto}%`, `${pPractica}%`, '', '']);
        wsData.push([]);

        // Encabezados
        wsData.push(headerRow);

        // Fila de inicio de datos (0-indexed: fila 6 = row 7 en Excel)
        const dataStartRow = wsData.length + 1; // +1 porque Excel es 1-indexed

        alumnos.forEach((alumno, index) => {
            const numRegistro = alumno['Número de Registro'] || alumno.numero_registro || '';
            const matricula = alumno.matricula || alumno['ID'] || alumno['Matrícula'] || '';
            const nombre = alumno.nombre || alumno['Nombre de Alumno'] || alumno['Nombre'] || '';
            const status = alumno['Status de Inscripción'] || alumno.status || '';
            const nivel = alumno['Nivel'] || alumno.nivel || '';
            const creditos = alumno['Créditos'] || alumno.creditos || '';
            const email = alumno.email || alumno['Email'] || '';
            const tarea = normalizarCalificacion(alumno.tarea || alumno['Tareas'] || 0);
            const examen = normalizarCalificacion(alumno.examen || alumno['Exámenes'] || 0);
            const participacion = normalizarCalificacion(alumno.participacion || alumno['Participación'] || 0);
            const proyecto = normalizarCalificacion(alumno.proyecto || alumno['Proyectos'] || 0);
            const practica = normalizarCalificacion(alumno.practica || alumno['Prácticas'] || 0);

            const excelRow = dataStartRow + index;
            // Columnas: I=Tareas, J=Exámenes, K=Participación, L=Proyectos, M=Prácticas
            // N=Calificación (sin redondeo), O=Calificación Final (redondeada)
            const formulaSinRedondeo = `ROUND(I${excelRow}*${pTarea}/100 + J${excelRow}*${pExamen}/100 + K${excelRow}*${pParticipacion}/100 + L${excelRow}*${pProyecto}/100 + M${excelRow}*${pPractica}/100, 2)`;
            // Redondeo personalizado: .5 baja, .6 sube → IF(N-INT(N)>=0.6, INT(N)+1, INT(N))
            const formulaRedondeo = `IF(N${excelRow}-INT(N${excelRow})>=0.6, INT(N${excelRow})+1, INT(N${excelRow}))`;

            wsData.push([
                index + 1,
                numRegistro,
                matricula,
                nombre,
                status,
                nivel,
                creditos,
                email,
                tarea,
                examen,
                participacion,
                proyecto,
                practica,
                { f: formulaSinRedondeo },
                { f: formulaRedondeo }
            ]);
        });

        // Fila de resumen
        const lastDataRow = dataStartRow + alumnos.length - 1;
        wsData.push([]);
        wsData.push([
            '', '', '', 'Total alumnos:', alumnos.length,
            '', '', '', '', '', '', '', '',
            { f: `AVERAGE(N${dataStartRow}:N${lastDataRow})` },
            { f: `AVERAGE(O${dataStartRow}:O${lastDataRow})` }
        ]);

        // Crear workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Ajustar anchos de columna
        ws['!cols'] = [
            { wch: 5 },   // No.
            { wch: 18 },  // Número de Registro
            { wch: 15 },  // Matrícula
            { wch: 35 },  // Nombre Completo
            { wch: 20 },  // Status de Inscripción
            { wch: 10 },  // Nivel
            { wch: 10 },  // Créditos
            { wch: 30 },  // Email
            { wch: 14 },  // Tareas
            { wch: 14 },  // Exámenes
            { wch: 16 },  // Participación
            { wch: 14 },  // Proyectos
            { wch: 14 },  // Prácticas
            { wch: 16 },  // Calificación (sin redondeo)
            { wch: 18 },  // Calificación Final (redondeada)
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');

        // Hoja 2: Ponderaciones
        const ponderacionesData = [
            ['Configuración de Ponderaciones'],
            [],
            ['Tipo', 'Porcentaje (%)'],
            ['Tareas', pTarea],
            ['Exámenes', pExamen],
            ['Participación', pParticipacion],
            ['Proyectos', pProyecto],
            ['Prácticas', pPractica],
            [],
            ['Total', { f: 'SUM(B4:B8)' }],
            [],
            ['Fórmula de calificación final:'],
            [`Cal. Final = (Tareas × ${pTarea}% + Exámenes × ${pExamen}% + Participación × ${pParticipacion}% + Proyectos × ${pProyecto}% + Prácticas × ${pPractica}%) / 100`]
        ];

        const ws2 = XLSX.utils.aoa_to_sheet(ponderacionesData);
        ws2['!cols'] = [{ wch: 20 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Ponderaciones');

        // Descargar
        const fileName = `calificaciones_${nombreMateria.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim()}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        mostrarToast(`Excel exportado: ${alumnos.length} estudiantes con fórmulas`, 'success');
        console.log('✅ Exportación Excel completada:', { estudiantes: alumnos.length, archivo: fileName });

    } catch (error) {
        console.error('❌ Error al exportar Excel:', error);
        mostrarToast(error.message || 'Error al exportar archivo', 'error');
    }
}

// Función para eliminar todos los alumnos de una materia
async function eliminarTodosAlumnos() {
    try {
        const materia_id = document.getElementById('materiaSelect').value;
        
        if (!materia_id) {
            mostrarToast('Por favor selecciona una materia', 'warning');
            return;
        }
        
        // Confirmar eliminación
        const confirmacion = confirm(`¿Estás seguro de que quieres eliminar TODOS los alumnos de esta materia?\n\nEsta acción eliminará:\n• Todas las inscripciones\n• Todas las calificaciones\n• No se puede deshacer`);
        
        if (!confirmacion) {
            return;
        }
        
        console.log('🗑️ Eliminando todos los alumnos de la materia:', materia_id);
        
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/calificaciones/materia/${materia_id}/alumnos`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await res.json();
        
        if (res.ok) {
            mostrarToast(`${data.message}: ${data.total_eliminados} alumnos eliminados`, 'success');
            console.log('✅ Todos los alumnos eliminados:', data);
            
            // Recargar la lista de alumnos
            await cargarAlumnos();
            
            // Limpiar tabla de vista previa si existe
            document.getElementById('previewTable').innerHTML = '';
            
        } else {
            mostrarToast(data.message || 'Error al eliminar alumnos', 'error');
            console.error('❌ Error al eliminar todos los alumnos:', data);
        }
        
    } catch (error) {
        console.error('❌ Error al eliminar todos los alumnos:', error);
        mostrarToast(error.message || 'Error al eliminar alumnos', 'error');
    }
}

function cancelarProcesoHTM() {
    document.getElementById('previewTable').innerHTML = '';
    document.getElementById('fileInput').value = '';
    window.tempFile = null;
    window.processedData = null;
    mostrarToast('Proceso HTM cancelado', 'info');
}
