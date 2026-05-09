document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMaterias();
    await cargarHistorial();
    await cargarAlumnos();
});

async function cargarMaterias() {
    const materias = await apiRequest('/materias');
    const select = document.getElementById('materiaSelect');
    select.innerHTML = '<option value="">Seleccionar materia</option>' + materias.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
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
    if (ext === '.pdf') {
        document.getElementById('previewTable').innerHTML = '<div class="alert alert-info">Archivo PDF listo para subir. No requiere vista previa.</div>';
        return;
    }

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
        
        const headers = headerCells.map((cell, index) => {
            let header = cell.textContent.trim();
            console.log(`🔍 Procesando encabezado ${index}: "${header}"`);
            
            let mappedHeader = '';
            
            if (header.includes('Número de Registro') || header.includes('Número de<br>Registro') || header.includes('Registro')) {
                mappedHeader = 'Número de Registro';
            } else if (header.includes('Nombre de Alumno') || header.includes('Nombre')) {
                mappedHeader = 'Nombre de Alumno';
            } else if (header.includes('ID') || header.includes('Identificación')) {
                mappedHeader = 'ID';
            } else if (header.includes('Status de Inscripción') || header.includes('Status')) {
                mappedHeader = 'Status de Inscripción';
            } else if (header.includes('Nivel')) {
                mappedHeader = 'Nivel';
            } else if (header.includes('Créditos')) {
                mappedHeader = 'Créditos';
            } else if (header.includes('Detalle de Calificaciones') || header.includes('Calificaciones')) {
                mappedHeader = 'Email';
            } else if (header && header.trim()) {
                mappedHeader = header.trim();
            } else {
                mappedHeader = `Columna ${index + 1}`;
            }
            
            console.log(`🔍 Encabezado mapeado: "${header}" -> "${mappedHeader}"`);
            return mappedHeader;
        });
        
        console.log('📋 Encabezados detectados:', headers);
        
        const dataRows = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = Array.from(row.querySelectorAll('td'));
            
            if (cells.length < 7) {
                console.log(`⚠️ Fila ${i} ignorada: muy pocas celdas (${cells.length})`);
                continue;
            }
            
            const rowData = {};
            
            const numeroRegistro = cells[0]?.textContent.trim() || '';
            rowData['Número de Registro'] = numeroRegistro;
            
            const nombreCell = cells[1];
            const nombreSpan = nombreCell?.querySelector('.fieldmediumtext');
            const nombreAlumno = nombreSpan?.textContent.trim() || nombreCell?.textContent.trim() || '';
            rowData['Nombre de Alumno'] = nombreAlumno;
            
            const idCell = cells[2];
            const idSpan = idCell?.querySelector('.fieldmediumtext');
            const idAlumno = idSpan?.textContent.trim() || idCell?.textContent.trim() || '';
            rowData['ID'] = idAlumno;
            
            const statusCell = cells[3];
            const statusSpan = statusCell?.querySelector('.fieldmediumtext');
            const statusInscripcion = statusSpan?.textContent.trim() || statusCell?.textContent.trim() || '';
            rowData['Status de Inscripción'] = statusInscripcion;
            
            const nivelCell = cells[4];
            const nivelSpan = nivelCell?.querySelector('.fieldmediumtext');
            const nivel = nivelSpan?.textContent.trim() || nivelCell?.textContent.trim() || '';
            rowData['Nivel'] = nivel;
            
            const creditosCell = cells[5];
            const creditosSpan = creditosCell?.querySelector('.fieldmediumtext');
            const creditos = creditosSpan?.textContent.trim() || creditosCell?.textContent.trim() || '';
            rowData['Créditos'] = creditos;
            
            let email = '';
            for (let j = 6; j < cells.length; j++) {
                const emailCell = cells[j];
                const emailLink = emailCell?.querySelector('a[href^="mailto:"]');
                if (emailLink) {
                    email = emailLink.getAttribute('href').replace('mailto:', '');
                    break;
                }
            }
            rowData['Email'] = email;
            
            rowData['Matrícula'] = idAlumno;
            rowData['Nombre'] = nombreAlumno;
            
            rowData['Tareas'] = 0;
            rowData['Exámenes'] = 0;
            rowData['Participación'] = 0;
            rowData['Proyectos'] = 0;
            rowData['Prácticas'] = 0;
            rowData['Calificación Final'] = 0;
            
            if (idAlumno || nombreAlumno) {
                dataRows.push(rowData);
                console.log(`✅ Fila ${i} procesada:`, {
                    'Número de Registro': numeroRegistro,
                    'Nombre de Alumno': nombreAlumno,
                    'ID': idAlumno,
                    'Email': email,
                    'Status': statusInscripcion,
                    'Nivel': nivel,
                    'Créditos': creditos
                });
            } else {
                console.log(`⚠️ Fila ${i} ignorada: no tiene ID ni nombre válidos`);
            }
        }
        
        console.log(`📊 Total de filas procesadas: ${dataRows.length} de ${rows.length - 1} filas de datos`);
        
        if (dataRows.length === 0) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">No se encontraron datos válidos en la tabla.</div>';
            return;
        }
        
        const calificacionesHeaders = ['Tareas', 'Exámenes', 'Participación', 'Proyectos', 'Prácticas', 'Calificación Final', 'Acciones'];
        const allHeaders = [...headers, ...calificacionesHeaders];
        
        let html = `<h4>Vista previa (primeros 10 registros)</h4>
                    <table class="asistencia-tabla">
                        <thead><tr>${allHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                        <tbody>`;
        
        dataRows.slice(0, 10).forEach(row => {
            html += '<tr>';
            allHeaders.forEach(header => {
                if (calificacionesHeaders.includes(header)) {
                    if (header === 'Acciones') {
                        html += `<td>
                            <button type="button" class="btn btn-sm btn-secondary" disabled>
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger" disabled>
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>`;
                    } else if (header === 'Calificación Final') {
                        html += `<td><span class="badge badge-info">0.00</span></td>`;
                    } else {
                        html += `<td><input type="number" value="0" min="0" max="10" step="0.1" disabled style="width: 80px;"></td>`;
                    }
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
            headers: headers,
            rows: dataRows
        };
        
        document.getElementById('previewTable').innerHTML = html;
        console.log('📊 Datos procesados:', window.processedData);
    };
    
    reader.readAsText(file);
}

async function confirmarSubida() {
    if (!window.tempFile) {
        mostrarToast('No hay archivo para procesar', 'error');
        return;
    }
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        mostrarToast('Seleccione una materia', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('archivo', window.tempFile);
    formData.append('materia_id', materia_id);

    const token = localStorage.getItem('token');
    const res = await fetch(`${window.API_URL}/calificaciones/upload`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`
            // No especificar Content-Type para FormData, el navegador lo establece automáticamente
        },
        body: formData
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
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-error">${data.message || 'Error al procesar archivo HTM'}</div>`;
        mostrarToast(data.message || 'Error al procesar archivo', 'error');
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
                                <th>Calificación Final</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (alumnos.length === 0) {
            html += `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 2rem; color: #64748b;">
                        <i class="fas fa-user-plus" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                        <div>Usa el botón "Agregar Alumno" para comenzar a registrar calificaciones</div>
                    </td>
                </tr>
            `;
        } else {
            alumnos.forEach(alumno => {
                const calificacionColor = alumno.calificacion_final >= 9 ? 'success' : 
                                        alumno.calificacion_final >= 7 ? 'warning' : 'danger';
                
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
                            <span class="badge badge-${calificacionColor}" id="final_${alumno.id}">${alumno.calificacion_final || 0}</span>
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

        document.getElementById('alumnosTable').innerHTML = html;
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
            mostrarToast('Alumno creado', 'success');
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
    if (!confirm('¿Estás seguro de eliminar este alumno? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        await apiRequest(`/calificaciones/alumnos/${alumnoId}`, {
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
        tareas: parseFloat(document.getElementById('ponderacionTareas').value) || 20,
        examenes: parseFloat(document.getElementById('ponderacionExamenes').value) || 30,
        participacion: parseFloat(document.getElementById('ponderacionParticipacion').value) || 10,
        proyectos: parseFloat(document.getElementById('ponderacionProyectos').value) || 20,
        practicas: parseFloat(document.getElementById('ponderacionPracticas').value) || 20
    };
    
    try {
        await apiRequest('/calificaciones/ponderaciones', {
            method: 'POST',
            body: JSON.stringify({
                materia_id: materia_id,
                ...ponderaciones
            })
        });
        
        mostrarToast('Ponderaciones guardadas correctamente', 'success');
    } catch (error) {
        console.log('No hay ponderaciones guardadas, usando valores por defecto');
        validarPonderaciones();
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
            tareas: parseFloat(document.getElementById('ponderacionTareas').value) || 0,
            examenes: parseFloat(document.getElementById('ponderacionExamenes').value) || 0,
            participacion: parseFloat(document.getElementById('ponderacionParticipacion').value) || 0,
            proyectos: parseFloat(document.getElementById('ponderacionProyectos').value) || 0,
            practicas: parseFloat(document.getElementById('ponderacionPracticas').value) || 0
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
            calificacion: parseFloat(valor) || 0
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
        
        const tarea = (tareaElement && tareaElement.value) ? parseFloat(tareaElement.value) || 0 : 0;
        const examen = (examenElement && examenElement.value) ? parseFloat(examenElement.value) || 0 : 0;
        const participacion = (participacionElement && participacionElement.value) ? parseFloat(participacionElement.value) || 0 : 0;
        const proyecto = (proyectoElement && proyectoElement.value) ? parseFloat(proyectoElement.value) || 0 : 0;
        const practica = (practicaElement && practicaElement.value) ? parseFloat(practicaElement.value) || 0 : 0;
        
        const calificacionFinal = (
            (proyecto * 0.30) +      
            (examen * 0.30) +        
            (participacion * 0.10) +   
            (tarea * 0.20) +          
            (practica * 0.10)          
        );
        
        const calificacionFinalAjustada = Math.max(0, Math.min(10, calificacionFinal));
        
        const finalElement = document.getElementById(`final_${estudianteId}`);
        if (finalElement) {
            finalElement.textContent = calificacionFinalAjustada.toFixed(2);
            
            let colorClass = 'badge-danger';
            if (calificacionFinalAjustada >= 9) colorClass = 'badge-success';
            else if (calificacionFinalAjustada >= 8) colorClass = 'badge-primary';
            else if (calificacionFinalAjustada >= 7) colorClass = 'badge-warning';
            else if (calificacionFinalAjustada >= 6) colorClass = 'badge-info';
            
            finalElement.className = `badge ${colorClass}`;
        }
        
        console.log(`Calificación final recalculada para estudiante ${estudianteId}: ${calificacionFinalAjustada.toFixed(2)}`);
        console.log(`Componentes: Tarea(${tarea}*0.20) + Examen(${examen}*0.30) + Participación(${participacion}*0.10) + Proyecto(${proyecto}*0.30) + Práctica(${practica}*0.10)`);
        
    } catch (error) {
        console.error('Error al recalcular calificación final:', error);
        console.error('Stack trace:', error.stack);
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
        let data;
        if (window.processedData && window.processedData.rows && window.processedData.rows.length > 0) {
            data = window.processedData.rows;
            console.log('📊 Exportando datos procesados del archivo HTM:', data.length, 'estudiantes');
        } else {
            const result = await apiRequest(`/calificaciones/materia/${materia_id}/exportar`);
            data = result.students || result;
            console.log('📊 Exportando datos de la base de datos:', data.length, 'estudiantes');
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
            mostrarToast('No hay datos para exportar', 'error');
            return;
        }

        let csvContent = '\ufeff';
        
        const headers = new Set();
        data.forEach(row => {
            Object.keys(row).forEach(key => headers.add(key));
        });
        
        const headerArray = Array.from(headers);
        
        csvContent += headerArray.map(header => {
            const formattedHeader = header
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            return `"${formattedHeader}"`;
        }).join(',') + '\n';
        
        data.forEach(row => {
            const rowData = headerArray.map(header => {
                const value = row[header] || '';
                if (typeof value === 'number') {
                    return value.toFixed(1);
                }
                const stringValue = String(value).replace(/"/g, '""');
                return stringValue.includes(',') || stringValue.includes('"') ? `"${stringValue}"` : stringValue;
            });
            csvContent += rowData.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `calificaciones_materia_${materia_id}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        mostrarToast(`Archivo exportado correctamente: ${data.length} estudiantes`, 'success');
        console.log('✅ Exportación completada:', {
            estudiantes: data.length,
            columnas: headerArray.length,
            archivo: `calificaciones_materia_${materia_id}_${new Date().toISOString().split('T')[0]}.csv`
        });
        
    } catch (error) {
        console.error('❌ Error al exportar Excel:', error);
        mostrarToast(error.message || 'Error al exportar archivo', 'error');
    }
}

function cancelarProcesoHTM() {
    document.getElementById('previewTable').innerHTML = '';
    document.getElementById('fileInput').value = '';
    window.tempFile = null;
    window.processedData = null;
    mostrarToast('Proceso HTM cancelado', 'info');
}
