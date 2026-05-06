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
        await cargarAlumnos(); // Actualizar lista de alumnos
    } else {
        mostrarToast(data.message || 'Error al subir archivo', 'error');
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-error">${data.message || 'Error al subir archivo'}</div>`;
    }
}

async function descargarPlantilla() {
    try {
        const data = await apiRequest('/calificaciones/plantilla');
        
        // Crear un enlace temporal para descargar el archivo
        const link = document.createElement('a');
        link.href = `${window.API_URL}${data.archivo_url}`;
        link.download = data.nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
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


// Función para leer y validar el archivo Excel/PDF
async function previsualizarArchivo(input) {
    const file = input.files[0];
    if (!file) return;

    // Validar extensión
    const validExt = ['.xlsx', '.xls', '.pdf'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExt.includes(ext)) {
        document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">Solo se permiten archivos Excel (.xlsx, .xls) o PDF.</div>';
        return;
    }
    window.tempFile = file;
    if (ext === '.pdf') {
        document.getElementById('previewTable').innerHTML = '<div class="alert alert-info">Archivo PDF listo para subir. No requiere vista previa.</div>';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (rows.length === 0) {
            document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">El archivo está vacío.</div>';
            return;
        }

        // Validar columnas requeridas (exactamente esos nombres)
        const requiredCols = ['Materia', 'Nombre', 'Calificacion'];
        const firstRow = rows[0];
        const missing = requiredCols.filter(col => !firstRow.hasOwnProperty(col));
        if (missing.length) {
            document.getElementById('previewTable').innerHTML = `<div class="alert alert-error">Error: Faltan columnas: ${missing.join(', ')}. Asegúrate de que los encabezados sean exactamente "Materia", "Nombre", "Calificacion".</div>`;
            return;
        }

        // Mostrar previsualización (primeras 10 filas)
        let html = `<h4>Vista previa (primeros 10 registros)</h4>
                    <table class="asistencia-tabla">
                        <thead><tr>${requiredCols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
                        <tbody>`;
        rows.slice(0, 10).forEach(row => {
            html += `<tr>
                        <td>${row.Materia}</td>
                        <td>${row.Nombre}</td>
                        <td>${row.Calificacion}</td>
                     </tr>`;
        });
        html += `</tbody></table>
                 <button class="btn-login-buap" onclick="confirmarSubida()">Confirmar subida</button>`;
        document.getElementById('previewTable').innerHTML = html;

        // Guardar archivo temporalmente para subir después
        window.tempFile = file;
    };
    reader.readAsArrayBuffer(file);
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
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    const data = await res.json();
    if (res.ok) {
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-success">${data.message}<br>${data.archivo.detalles || ''}</div>`;
        cargarHistorial();   // recargar lista de archivos subidos
        await cargarAlumnos(); // actualizar lista de alumnos
        document.getElementById('previewTable').innerHTML = ''; // limpiar preview
        window.tempFile = null;
        document.getElementById('fileInput').value = '';
        mostrarToast('Archivo HTM procesado correctamente', 'success');
    } else {
        document.getElementById('resultadoUpload').innerHTML = `<div class="alert alert-error">${data.message || 'Error al procesar archivo HTM'}</div>`;
        mostrarToast(data.message || 'Error al procesar archivo', 'error');
    }
}

// Funciones para CRUD de alumnos
async function cargarAlumnos() {
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        document.getElementById('alumnosTable').innerHTML = '<div class="alert alert-info">Selecciona una materia para ver los alumnos.</div>';
        return;
    }

    try {
        const alumnos = await apiRequest(`/calificaciones/materia/${materia_id}/alumnos`);
        
        // Mostrar siempre la tabla, incluso si está vacía
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
            // Mostrar una fila vacía para demostrar que se pueden agregar alumnos
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
    if (alumnoId) {
        // Editar alumno existente
        editarAlumno(alumnoId);
    } else {
        // Agregar nuevo alumno
        document.getElementById('modalAlumnoTitulo').textContent = 'Agregar Alumno';
        document.getElementById('alumnoIdEdit').value = '';
        document.getElementById('formAlumno').reset();
        document.getElementById('modalAlumno').style.display = 'flex';
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

    if (!materia_id || !matricula || !nombre) {
        mostrarToast('Completa los campos obligatorios', 'error');
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
            await apiRequest('/calificaciones/alumnos', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            mostrarToast('Alumno creado', 'success');
        }

        cerrarModalAlumno();
        await cargarAlumnos();
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

// Funciones para manejo de ponderaciones
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
        // Si no hay ponderaciones guardadas, usar valores por defecto
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
        
        // Recargar la lista de alumnos para mostrar las calificaciones actualizadas
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
        
        // Recalcular calificación final automáticamente
        await recalcularCalificacionFinal(estudianteId, materia_id);
        
        mostrarToast('Calificación actualizada', 'success');
    } catch (error) {
        mostrarToast(error.message || 'Error al actualizar calificación', 'error');
        // Revertir el valor en caso de error
        document.getElementById(`${tipo}_${estudianteId}`).value = valor;
    }
}

async function recalcularCalificacionFinal(estudianteId, materia_id) {
    try {
        // Obtener valores directamente del DOM
        const tarea = parseFloat(document.getElementById(`tarea_${estudianteId}`)?.value) || 0;
        const examen = parseFloat(document.getElementById(`examen_${estudianteId}`)?.value) || 0;
        const participacion = parseFloat(document.getElementById(`participacion_${estudianteId}`)?.value) || 0;
        const proyecto = parseFloat(document.getElementById(`proyecto_${estudianteId}`)?.value) || 0;
        const practica = parseFloat(document.getElementById(`practica_${estudianteId}`)?.value) || 0;
        
        // Calcular promedio simple (sin ponderaciones por ahora)
        const calificacionFinal = (tarea + examen + participacion + proyecto + practica) / 5;
        
        // Actualizar la calificación final en la UI
        const finalElement = document.getElementById(`final_${estudianteId}`);
        if (finalElement) {
            finalElement.textContent = calificacionFinal.toFixed(2);
            
            // Actualizar el color del badge
            let colorClass = 'badge-danger';
            if (calificacionFinal >= 9) colorClass = 'badge-success';
            else if (calificacionFinal >= 8) colorClass = 'badge-primary';
            else if (calificacionFinal >= 7) colorClass = 'badge-warning';
            else if (calificacionFinal >= 6) colorClass = 'badge-info';
            
            finalElement.className = colorClass;
        }
        
        console.log(`Calificación final recalculada para estudiante ${estudianteId}: ${calificacionFinal.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error al recalcular calificación final:', error);
    }
}

function cerrarModalAlumno() {
    document.getElementById('modalAlumno').style.display = 'none';
}

async function exportarExcel() {
    const materia_id = document.getElementById('materiaSelect').value;
    if (!materia_id) {
        mostrarToast('Selecciona una materia', 'error');
        return;
    }

    try {
        const result = await apiRequest(`/calificaciones/materia/${materia_id}/exportar`);
        
        // Crear un enlace temporal para descargar el archivo
        const link = document.createElement('a');
        link.href = `${window.API_URL}${result.downloadUrl}`;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        mostrarToast('Excel exportado correctamente', 'success');
    } catch (error) {
        mostrarToast(error.message || 'Error al exportar a Excel', 'error');
    }
}

// Función de previsualización para archivos HTM
async function previsualizarArchivo(input) {
    const file = input.files[0];
    if (!file) return;

    try {
        // Obtener materia seleccionada
        const materiaSelect = document.getElementById('materiaSelect');
        const materia_id = materiaSelect ? materiaSelect.value : null;
        
        if (!materia_id) {
            mostrarToast('Selecciona una materia antes de subir el archivo', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('materia_id', materia_id);

        mostrarToast('Procesando archivo...', 'info');
        const result = await apiRequest('/calificaciones/upload', {
            method: 'POST',
            body: formData,
            headers: {} // No Content-Type para FormData
        });

        mostrarPreview(result);
        mostrarToast('Archivo procesado correctamente', 'success');
        
        // Mostrar controles del proceso HTM
        document.getElementById('procesoHTMControls').style.display = 'block';
        
        // Guardar referencia al resultado para poder procesarlo después
        window.currentHTMData = result;
        
    } catch (error) {
        mostrarToast(error.message || 'Error al procesar archivo', 'error');
        document.getElementById('previewTable').innerHTML = '';
        document.getElementById('resultadoUpload').innerHTML = '';
        document.getElementById('procesoHTMControls').style.display = 'none';
    }
}

async function confirmarSubida() {
    if (!window.tempFile) {
        mostrarToast('No hay archivo seleccionado', 'error');
        return;
    }

    try {
        // Obtener materia seleccionada
        const materiaSelect = document.getElementById('materiaSelect');
        const materia_id = materiaSelect ? materiaSelect.value : null;
        
        if (!materia_id) {
            mostrarToast('Selecciona una materia antes de subir el archivo', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', window.tempFile);
        formData.append('materia_id', materia_id);

        mostrarToast('Procesando archivo HTM...', 'info');
        const result = await apiRequest('/calificaciones/upload', {
            method: 'POST',
            body: formData,
            headers: {} // No Content-Type para FormData
        });

        mostrarPreview(result);
        mostrarToast('Archivo HTM procesado correctamente', 'success');
        
        // Mostrar controles del proceso HTM
        document.getElementById('procesoHTMControls').style.display = 'block';
        
        // Guardar referencia al resultado para poder procesarlo después
        window.currentHTMData = result;
        
    } catch (error) {
        mostrarToast(error.message || 'Error al procesar archivo HTM', 'error');
        document.getElementById('previewTable').innerHTML = '';
        document.getElementById('resultadoUpload').innerHTML = '';
        document.getElementById('procesoHTMControls').style.display = 'none';
    }
}

function mostrarPreview(resultado) {
    console.log('📋 Mostrando preview del resultado:', resultado);
    
    const previewTable = document.getElementById('previewTable');
    const resultadoUpload = document.getElementById('resultadoUpload');
    
    if (!resultado || !resultado.resultado) {
        previewTable.innerHTML = '<div class="alert alert-error">No se pudo procesar el archivo HTM</div>';
        resultadoUpload.innerHTML = '';
        return;
    }
    
    const { resultado: data, fileName } = resultado;
    
    // Mostrar información general
    resultadoUpload.innerHTML = `
        <div class="alert alert-success">
            <i class="fas fa-check-circle"></i>
            <strong>Archivo procesado correctamente:</strong> ${fileName}<br>
            <strong>Estudiantes procesados:</strong> ${data.procesados}<br>
            <strong>Nuevos:</strong> ${data.nuevos}<br>
            <strong>Actualizados:</strong> ${data.actualizados}
        </div>
    `;
    
    // Si hay información del curso, mostrarla
    if (data.courseInfo) {
        let courseHtml = '<div class="panel-card" style="margin-top: 15px;"><h3>Información del Curso</h3><table class="datadisplaytable">';
        
        Object.entries(data.courseInfo).forEach(([key, value]) => {
            courseHtml += `<tr><td class="dddefault"><strong>${key}:</strong></td><td class="dddefault">${value}</td></tr>`;
        });
        
        courseHtml += '</table></div>';
        resultadoUpload.innerHTML += courseHtml;
    }
    
    // Mostrar tabla de estudiantes procesados
    if (data.students && data.students.length > 0) {
        let studentsHtml = `
            <div class="panel-card" style="margin-top: 15px;">
                <h3>Estudiantes Procesados (${data.students.length})</h3>
                <div style="overflow-x: auto;">
                    <table class="datadisplaytable" style="min-width: 800px;">
                        <thead>
                            <tr>
                                <th class="ddheader">#</th>
                                <th class="ddheader">Nombre Completo</th>
                                <th class="ddheader">Matrícula</th>
                                <th class="ddheader">Email</th>
                                <th class="ddheader">Tareas</th>
                                <th class="ddheader">Exámenes</th>
                                <th class="ddheader">Proyectos</th>
                                <th class="ddheader">Prácticas</th>
                                <th class="ddheader">Calificación Final</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        data.students.forEach((student, index) => {
            const tareas = student.tareas || 0;
            const examenes = student.examenes || 0;
            const proyectos = student.proyectos || 0;
            const practicas = student.practicas || 0;
            const calificacionFinal = student.calificacion_final || 0;
            
            // Color según calificación
            let colorClass = '';
            if (calificacionFinal >= 9) colorClass = 'style="color: #22c55e; font-weight: bold;"';
            else if (calificacionFinal >= 8) colorClass = 'style="color: #3b82f6; font-weight: bold;"';
            else if (calificacionFinal >= 7) colorClass = 'style="color: #f59e0b; font-weight: bold;"';
            else if (calificacionFinal >= 6) colorClass = 'style="color: #f97316; font-weight: bold;"';
            else colorClass = 'style="color: #ef4444; font-weight: bold;"';
            
            studentsHtml += `
                <tr>
                    <td class="dddefault">${index + 1}</td>
                    <td class="dddefault">${student.nombre_completo || 'N/A'}</td>
                    <td class="dddefault">${student.numero_registro || 'N/A'}</td>
                    <td class="dddefault">${student.email || 'N/A'}</td>
                    <td class="dddefault">${tareas}</td>
                    <td class="dddefault">${examenes}</td>
                    <td class="dddefault">${proyectos}</td>
                    <td class="dddefault">${practicas}</td>
                    <td class="dddefault" ${colorClass}>${calificacionFinal.toFixed(2)}</td>
                </tr>
            `;
        });
        
        studentsHtml += '</tbody></table></div></div>';
        previewTable.innerHTML = studentsHtml;
        
        // Actualizar la tabla de alumnos editable
        cargarAlumnosDesdeHTM(data.students);
        
    } else {
        previewTable.innerHTML = '<div class="alert alert-warning">No se encontraron estudiantes en el archivo HTM</div>';
    }
}

function cargarAlumnosDesdeHTM(estudiantes) {
    console.log('🔄 Cargando alumnos desde HTM:', estudiantes.length);
    
    const alumnosTable = document.getElementById('alumnosTable');
    if (!alumnosTable) return;
    
    let html = `
        <div class="panel-card">
            <h3>Alumnos Procesados (Edición Habilitada)</h3>
            <div style="overflow-x: auto;">
                <table class="datadisplaytable" style="min-width: 1000px;">
                    <thead>
                        <tr>
                            <th class="ddheader">Matrícula</th>
                            <th class="ddheader">Nombre</th>
                            <th class="ddheader">Email</th>
                            <th class="ddheader">Tareas</th>
                            <th class="ddheader">Exámenes</th>
                            <th class="ddheader">Proyectos</th>
                            <th class="ddheader">Prácticas</th>
                            <th class="ddheader">Final</th>
                            <th class="ddheader">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    estudiantes.forEach((estudiante, index) => {
        const matricula = estudiante.numero_registro || '';
        const nombre = estudiante.nombre_completo || '';
        const email = estudiante.email || '';
        const tareas = estudiante.tareas || 0;
        const examenes = estudiante.examenes || 0;
        const proyectos = estudiante.proyectos || 0;
        const practicas = estudiante.practicas || 0;
        const calificacionFinal = estudiante.calificacion_final || 0;
        
        html += `
            <tr>
                <td class="dddefault">${matricula}</td>
                <td class="dddefault">${nombre}</td>
                <td class="dddefault">${email}</td>
                <td class="dddefault">
                    <input type="number" 
                           id="tarea_${index}" 
                           value="${tareas}" 
                           min="0" max="10" 
                           step="0.1"
                           style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;"
                           onchange="recalcularFinal(${index})">
                </td>
                <td class="dddefault">
                    <input type="number" 
                           id="examen_${index}" 
                           value="${examenes}" 
                           min="0" max="10" 
                           step="0.1"
                           style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;"
                           onchange="recalcularFinal(${index})">
                </td>
                <td class="dddefault">
                    <input type="number" 
                           id="proyecto_${index}" 
                           value="${proyectos}" 
                           min="0" max="10" 
                           step="0.1"
                           style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;"
                           onchange="recalcularFinal(${index})">
                </td>
                <td class="dddefault">
                    <input type="number" 
                           id="practica_${index}" 
                           value="${practicas}" 
                           min="0" max="10" 
                           step="0.1"
                           style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;"
                           onchange="recalcularFinal(${index})">
                </td>
                <td class="dddefault">
                    <span id="final_${index}" style="font-weight: bold; color: #2563eb;">
                        ${calificacionFinal.toFixed(2)}
                    </span>
                </td>
                <td class="dddefault">
                    <button type="button" 
                            class="btn btn-sm btn-primary" 
                            onclick="guardarCambiosAlumno(${index})"
                            style="padding: 4px 8px; font-size: 12px;">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div></div>';
    alumnosTable.innerHTML = html;
    
    // Guardar referencia a los estudiantes para poder usarlos después
    window.estudiantesHTM = estudiantes;
}

function recalcularFinal(index) {
    if (!window.estudiantesHTM || !window.estudiantesHTM[index]) return;
    
    const tareas = parseFloat(document.getElementById(`tarea_${index}`).value) || 0;
    const examenes = parseFloat(document.getElementById(`examen_${index}`).value) || 0;
    const proyectos = parseFloat(document.getElementById(`proyecto_${index}`).value) || 0;
    const practicas = parseFloat(document.getElementById(`practica_${index}`).value) || 0;
    
    // Calcular promedio simple sin redondeo
    const calificacionFinal = (tareas + examenes + proyectos + practicas) / 4;
    
    // Actualizar display
    const finalElement = document.getElementById(`final_${index}`);
    if (finalElement) {
        finalElement.textContent = calificacionFinal.toFixed(2);
        
        // Color según calificación
        if (calificacionFinal >= 9) finalElement.style.color = '#22c55e';
        else if (calificacionFinal >= 8) finalElement.style.color = '#3b82f6';
        else if (calificacionFinal >= 7) finalElement.style.color = '#f59e0b';
        else if (calificacionFinal >= 6) finalElement.style.color = '#f97316';
        else finalElement.style.color = '#ef4444';
    }
}

async function guardarCambiosAlumno(index) {
    if (!window.estudiantesHTM || !window.estudiantesHTM[index]) {
        mostrarToast('Error: no se encontró el estudiante', 'error');
        return;
    }
    
    const estudiante = window.estudiantesHTM[index];
    const tareas = parseFloat(document.getElementById(`tarea_${index}`).value) || 0;
    const examenes = parseFloat(document.getElementById(`examen_${index}`).value) || 0;
    const proyectos = parseFloat(document.getElementById(`proyecto_${index}`).value) || 0;
    const practicas = parseFloat(document.getElementById(`practica_${index}`).value) || 0;
    const calificacionFinal = (tareas + examenes + proyectos + practicas) / 4;
    
    try {
        await apiRequest('/calificaciones/actualizar', {
            method: 'PUT',
            body: JSON.stringify({
                estudiante_id: estudiante.id || estudiante.numero_registro,
                materia_id: document.getElementById('materiaSelect').value,
                tipo: 'tarea',
                calificacion: tareas
            })
        });
        
        await apiRequest('/calificaciones/actualizar', {
            method: 'PUT',
            body: JSON.stringify({
                estudiante_id: estudiante.id || estudiante.numero_registro,
                materia_id: document.getElementById('materiaSelect').value,
                tipo: 'examen',
                calificacion: examenes
            })
        });
        
        await apiRequest('/calificaciones/actualizar', {
            method: 'PUT',
            body: JSON.stringify({
                estudiante_id: estudiante.id || estudiante.numero_registro,
                materia_id: document.getElementById('materiaSelect').value,
                tipo: 'proyecto',
                calificacion: proyectos
            })
        });
        
        await apiRequest('/calificaciones/actualizar', {
            method: 'PUT',
            body: JSON.stringify({
                estudiante_id: estudiante.id || estudiante.numero_registro,
                materia_id: document.getElementById('materiaSelect').value,
                tipo: 'practica',
                calificacion: practicas
            })
        });
        
        mostrarToast('Calificaciones guardadas correctamente', 'success');
        
    } catch (error) {
        mostrarToast('Error al guardar calificaciones: ' + error.message, 'error');
    }
}

// Actualizar cuando se cambia la materia
document.getElementById('materiaSelect')?.addEventListener('change', async () => {
    await cargarAlumnos();
});

// Funciones para controlar el proceso HTM
function cancelarProcesoHTM() {
    if (!confirm('¿Estás seguro de cancelar el proceso? Se perderán todos los cambios no guardados.')) {
        return;
    }
    
    // Limpiar todo
    document.getElementById('previewTable').innerHTML = '';
    document.getElementById('resultadoUpload').innerHTML = '';
    document.getElementById('alumnosTable').innerHTML = '';
    document.getElementById('procesoHTMControls').style.display = 'none';
    
    // Limpiar archivo temporal
    window.tempFile = null;
    window.currentHTMData = null;
    window.estudiantesHTM = null;
    
    // Limpiar input de archivo
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.value = '';
    }
    
    mostrarToast('Proceso cancelado', 'info');
}

async function subirDefinitivamenteHTM() {
    if (!window.currentHTMData || !window.currentHTMData.resultado) {
        mostrarToast('No hay datos procesados para subir', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de subir definitivamente estas calificaciones? Esta acción enviará la información al administrador y no podrá deshacerse.')) {
        return;
    }
    
    try {
        const materia_id = document.getElementById('materiaSelect').value;
        const datos = window.currentHTMData.resultado;
        
        mostrarToast('Subiendo calificaciones definitivamente...', 'info');
        
        const result = await apiRequest('/calificaciones/procesar-definitivo', {
            method: 'POST',
            body: JSON.stringify({
                materia_id: materia_id,
                datos: datos
            })
        });
        
        mostrarToast(`Calificaciones subidas correctamente: ${result.procesados} procesados, ${result.errores} errores`, 'success');
        
        // Limpiar todo después de subir
        document.getElementById('previewTable').innerHTML = '';
        document.getElementById('resultadoUpload').innerHTML = '';
        document.getElementById('alumnosTable').innerHTML = '';
        document.getElementById('procesoHTMControls').style.display = 'none';
        
        window.tempFile = null;
        window.currentHTMData = null;
        window.estudiantesHTM = null;
        
        // Limpiar input de archivo
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Recargar alumnos para mostrar los cambios
        await cargarAlumnos();
        
    } catch (error) {
        mostrarToast('Error al subir calificaciones: ' + error.message, 'error');
    }
}

// Exportar funciones al scope global
window.eliminarArchivo = eliminarArchivo;
window.abrirModalAlumno = abrirModalAlumno;
window.editarAlumno = editarAlumno;
window.guardarAlumno = guardarAlumno;
window.eliminarAlumno = eliminarAlumno;
window.cerrarModalAlumno = cerrarModalAlumno;
window.exportarExcel = exportarExcel;
window.cargarAlumnos = cargarAlumnos;
window.descargarPlantilla = descargarPlantilla;
window.cancelarProcesoHTM = cancelarProcesoHTM;
window.subirDefinitivamenteHTM = subirDefinitivamenteHTM;
window.previsualizarArchivo = previsualizarArchivo;
window.confirmarSubida = confirmarSubida;
window.recalcularFinal = recalcularFinal;
window.guardarCambiosAlumno = guardarCambiosAlumno;