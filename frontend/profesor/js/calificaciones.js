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
        if (alumnos.length === 0) {
            document.getElementById('alumnosTable').innerHTML = '<div class="empty-state">No hay alumnos registrados en esta materia.</div>';
            return;
        }

        let html = `
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
                        <span class="badge badge-${calificacionColor}" id="final_${alumno.id}">${alumno.calificacion_final}</span>
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

        html += `
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('alumnosTable').innerHTML = html;
    } catch (error) {
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
        // Obtener las ponderaciones actuales
        const ponderaciones = await apiRequest(`/calificaciones/ponderaciones/${materia_id}`);
        
        // Obtener todas las calificaciones del estudiante
        const calificaciones = await apiRequest(`/calificaciones/estudiante/${estudianteId}/materia/${materia_id}`);
        
        // Calcular promedio ponderado
        let calificacionFinal = 0;
        const calificacionesMap = {};
        
        calificaciones.forEach(cal => {
            if (cal.tipo !== 'final') {
                calificacionesMap[cal.tipo] = cal.calificacion;
            }
        });
        
        // Aplicar ponderaciones
        calificacionFinal += (calificacionesMap.tarea || 0) * (ponderaciones.tareas / 100);
        calificacionFinal += (calificacionesMap.examen || 0) * (ponderaciones.examenes / 100);
        calificacionFinal += (calificacionesMap.participacion || 0) * (ponderaciones.participacion / 100);
        calificacionFinal += (calificacionesMap.proyecto || 0) * (ponderaciones.proyectos / 100);
        calificacionFinal += (calificacionesMap.practica || 0) * (ponderaciones.practicas / 100);
        
        // Actualizar la calificación final en la UI
        const finalElement = document.getElementById(`final_${estudianteId}`);
        if (finalElement) {
            finalElement.textContent = calificacionFinal.toFixed(1);
            
            // Actualizar el color del badge
            finalElement.className = 'badge badge-' + (
                calificacionFinal >= 9 ? 'success' : 
                calificacionFinal >= 7 ? 'warning' : 'danger'
            );
        }
        
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

    // Validar extensión
    const validExt = ['.htm', '.html'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExt.includes(ext)) {
        document.getElementById('previewTable').innerHTML = '<div class="alert alert-error">Solo se permiten archivos HTM (.htm, .html).</div>';
        return;
    }

    window.tempFile = file;
    
    if (ext === '.htm' || ext === '.html') {
        document.getElementById('previewTable').innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i>
                <strong>Archivo HTM de lista de clase BUAP listo para procesar.</strong><br>
                El sistema extraerá automáticamente: Nombre completo, matrícula, email, y toda la información del curso.
            </div>
            <div style="margin-top: 15px;">
                <button class="btn btn-primary" onclick="confirmarSubida()">
                    <i class="fas fa-upload"></i> Procesar Archivo HTM
                </button>
            </div>
        `;
        return;
    }
}

// Actualizar cuando se cambia la materia
document.getElementById('materiaSelect')?.addEventListener('change', async () => {
    await cargarAlumnos();
});

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