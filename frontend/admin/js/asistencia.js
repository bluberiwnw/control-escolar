document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMaterias();
    document.getElementById('fechaAsistencia').valueAsDate = new Date();
    document.getElementById('todasLasFechas').addEventListener('change', toggleFiltroFechas);
    await cargarAsistencias();
});

function toggleFiltroFechas() {
    const verTodas = document.getElementById('todasLasFechas').checked;
    document.getElementById('fechaAsistencia').disabled = verTodas;
}

async function cargarMaterias() {
    try {
        const materias = await apiRequest('/admin/materias');
        const select = document.getElementById('materiaSelect');
        select.innerHTML =
            '<option value="">Todas las materias</option>' +
            materias.map((m) => `<option value="${m.id}">${m.nombre}</option>`).join('');
    } catch (error) {
        console.error('Error cargando materias:', error);
        const select = document.getElementById('materiaSelect');
        select.innerHTML = '<option value="">Error cargando materias</option>';
        mostrarToast('Error al cargar materias. Intenta recargar la página.', 'warning');
    }
}

function selectEstado(asistencia) {
    return `
        <select onchange="actualizarAsistencia(${asistencia.id}, this.value)">
            <option value="presente" ${asistencia.estado === 'presente' ? 'selected' : ''}>Presente</option>
            <option value="ausente" ${asistencia.estado === 'ausente' ? 'selected' : ''}>Ausente</option>
            <option value="retardo" ${asistencia.estado === 'retardo' ? 'selected' : ''}>Retardo</option>
        </select>
    `;
}

async function cargarAsistencias() {
    const materiaId = document.getElementById('materiaSelect').value;
    const materiaNombre = document.getElementById('materiaSelect').options[document.getElementById('materiaSelect').selectedIndex]?.text || 'Todas las materias';
    const fecha = document.getElementById('fechaAsistencia').value;
    const todasLasFechas = document.getElementById('todasLasFechas').checked;
    
    let url = '/admin/asistencias?';
    if (materiaId) url += `materia_id=${materiaId}&`;
    if (fecha && !todasLasFechas) url += `fecha=${fecha}&`;
    
    try {
        const asistencias = await apiRequest(url);
        
        // Ocultar información de filtros para mejor encaje visual
        let filtrosInfo = '';
        
        if (!asistencias.length) {
            document.getElementById('asistenciasContainer').innerHTML =
                '<div class="empty-state">No hay asistencias para los filtros.</div>';
            return;
        }
        
        document.getElementById('asistenciasContainer').innerHTML = filtrosInfo + 
            `<div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Estudiante</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
                ${asistencias.map(a => `<tr>
                    <td data-label="Materia"><span class="materia-destacada">${a.materia_nombre}</span></td>
                    <td data-label="Estudiante">${a.estudiante_nombre}</td>
                    <td data-label="Fecha">${formatearFecha(a.fecha)}</td>
                    <td data-label="Estado">${selectEstado(a)}</td>
                    <td data-label="Acciones" class="table-actions">
                        <button type="button" class="btn btn-danger btn-sm" onclick="eliminarAsistencia(${a.id})">Eliminar</button>
                    </td>
                </tr>`).join('')}
            </tbody></table></div>`;
    } catch (error) {
        console.error('Error cargando asistencias:', error);
        document.getElementById('asistenciasContainer').innerHTML = 
            '<div class="empty-state">Error al cargar asistencias. El servidor puede estar temporalmente no disponible. Intenta recargar la página.</div>';
        mostrarToast('Error al cargar asistencias. El servidor está temporalmente no disponible.', 'warning');
    }
}

async function actualizarAsistencia(id, estado) {
    try {
        await apiRequest(`/admin/asistencias/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ estado }),
        });
        mostrarToast('Asistencia actualizada', 'success');
    } catch (error) {
        console.error('Error actualizando asistencia:', error);
        mostrarToast('Error al actualizar asistencia. El servidor está temporalmente no disponible.', 'error');
    }
}

async function eliminarAsistencia(id) {
    if (!confirm('Eliminar este registro de asistencia?')) return;
    try {
        await apiRequest(`/admin/asistencias/${id}`, { method: 'DELETE' });
        mostrarToast('Asistencia eliminada', 'success');
        cargarAsistencias();
    } catch (error) {
        console.error('Error eliminando asistencia:', error);
        mostrarToast('Error al eliminar asistencia. El servidor está temporalmente no disponible.', 'error');
    }
}
async function generarReportesAsistencia() {
    const materiaId = document.getElementById('materiaSelect')?.value;
    const todasLasMaterias = !materiaId;
    
    try {
        let datos;
        if (todasLasMaterias) {
            // Reporte general de todas las materias
            try {
                datos = await apiRequest('/admin/asistencias/reportes/general');
            } catch (error) {
                console.error('Error en reporte general:', error);
                // Datos de fallback si el servidor falla
                datos = {
                    total_clases: 0,
                    total_presentes: 0,
                    total_ausentes: 0,
                    total_retardos: 0,
                    por_materia: []
                };
                mostrarToast('El servidor no está disponible. Mostrando datos limitados.', 'warning');
            }
        } else if (materiaId) {
            // Reporte específico de una materia con opción de reporte por curso
            try {
                // Intentar obtener reporte por curso específico
                datos = await apiRequest(`/admin/asistencias/reporte/curso/${materiaId}`);
            } catch (error) {
                console.error('Error en reporte por curso:', error);
                // Si falla, intentar con estadísticas generales
                try {
                    datos = await apiRequest(`/profesor/estadisticas?materia_id=${materiaId}`);
                } catch (fallbackError) {
                    console.error('Error en estadísticas de materia:', fallbackError);
                    // Datos de fallback si el servidor falla
                    datos = {
                        totales: {
                            total_presentes: 0,
                            total_ausentes: 0,
                            total_retardos: 0,
                            total_clases: 0
                        },
                        por_fecha: []
                    };
                    mostrarToast('El servidor no está disponible. Mostrando datos limitados.', 'warning');
                }
            }
        } else {
            mostrarToast('Por favor selecciona una materia para generar reportes.', 'warning');
            return;
        }
        
        mostrarReportesAsistencia(datos, todasLasMaterias);
    } catch (error) {
        console.error('Error general en generarReportesAsistencia:', error);
        const container = document.getElementById('reportesContainer');
        if (container) {
            container.innerHTML = '<div class="panel-card"><h3>📊 Reportes de Asistencia</h3><p>Error al generar reportes. El servidor está temporalmente no disponible.</p></div>';
        }
        mostrarToast('Error al generar reportes. El servidor está temporalmente no disponible.', 'error');
    }
}

function mostrarReportesAsistencia(datos, esGeneral) {
    const container = document.getElementById('reportesContainer');
    if (!container) return;
    
    let html = '<div class="panel-card"><h3>📊 Reportes de Asistencia</h3>';
    
    if (esGeneral) {
        // Reporte general
        html += `
            <div class="stats-grid">
                <div class="stat-item total">
                    <span class="stat-number">${datos.total_clases || 0}</span>
                    <span class="stat-label">Total Clases</span>
                </div>
                <div class="stat-item presente">
                    <span class="stat-number">${datos.total_presentes || 0}</span>
                    <span class="stat-label">Total Presentes</span>
                </div>
                <div class="stat-item ausente">
                    <span class="stat-number">${datos.total_ausentes || 0}</span>
                    <span class="stat-label">Total Ausentes</span>
                </div>
                <div class="stat-item retardo">
                    <span class="stat-number">${datos.total_retardos || 0}</span>
                    <span class="stat-label">Total Retardos</span>
                </div>
            </div>
        `;
        
        if (datos.por_materia && datos.por_materia.length > 0) {
            html += '<h4>Por Materia:</h4><div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Materia</th><th>Presentes</th><th>Ausentes</th><th>Retardos</th><th>Total</th><th>% Asistencia</th></tr></thead><tbody>';
            datos.por_materia.forEach(materia => {
                const porcentaje = materia.total > 0 ? ((materia.presentes / materia.total) * 100).toFixed(1) : 0;
                html += `
                    <tr>
                        <td data-label="Materia">${materia.materia_nombre}</td>
                        <td data-label="Presentes">${materia.presentes}</td>
                        <td data-label="Ausentes">${materia.ausentes}</td>
                        <td data-label="Retardos">${materia.retardos}</td>
                        <td data-label="Total">${materia.total}</td>
                        <td data-label="% Asistencia">${porcentaje}%</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        }
    } else if (datos.materia && datos.estadisticas_generales) {
        // Reporte por curso específico con porcentajes
        const stats = datos.estadisticas_generales;
        html += `
            <div class="curso-header">
                <h4>📚 Curso: ${datos.materia.nombre}</h4>
                <p><strong>Clave:</strong> ${datos.materia.clave}</p>
                <p><strong>Horario:</strong> ${datos.materia.horario}</p>
            </div>
            <div class="stats-grid">
                <div class="stat-item total">
                    <span class="stat-number">${stats.total_clases}</span>
                    <span class="stat-label">Total Clases</span>
                </div>
                <div class="stat-item presente">
                    <span class="stat-number">${stats.total_presentes}</span>
                    <span class="stat-label">Presentes (${stats.porcentaje_asistencia_general}%)</span>
                </div>
                <div class="stat-item ausente">
                    <span class="stat-number">${stats.total_ausentes}</span>
                    <span class="stat-label">Ausentes</span>
                </div>
                <div class="stat-item retardo">
                    <span class="stat-number">${stats.total_retardos}</span>
                    <span class="stat-label">Retardos</span>
                </div>
                <div class="stat-item estudiantes">
                    <span class="stat-number">${stats.total_estudiantes}</span>
                    <span class="stat-label">Total Estudiantes</span>
                </div>
            </div>
        `;
        
        // Resumen de categorías
        if (datos.resumen) {
            const resumen = datos.resumen;
            html += `
                <div class="resumen-section">
                    <h4>📈 Resumen de Rendimiento</h4>
                    <div class="resumen-grid">
                        <div class="resumen-item excelente">
                            <span class="resumen-number">${resumen.excelentes}</span>
                            <span class="resumen-label">Excelentes (≥90%)</span>
                        </div>
                        <div class="resumen-item bueno">
                            <span class="resumen-number">${resumen.buenos}</span>
                            <span class="resumen-label">Buenos (80-89%)</span>
                        </div>
                        <div class="resumen-item regular">
                            <span class="resumen-number">${resumen.regulares}</span>
                            <span class="resumen-label">Regulares (70-79%)</span>
                        </div>
                        <div class="resumen-item deficiente">
                            <span class="resumen-number">${resumen.deficientes}</span>
                            <span class="resumen-label">Deficientes (<70%)</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Detalle por estudiante
        if (datos.detalle_estudiantes && datos.detalle_estudiantes.length > 0) {
            html += `
                <h4>👥 Detalle por Estudiante</h4>
                <div class="table-responsive-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Estudiante</th>
                                <th>Email</th>
                                <th>Total Asistencias</th>
                                <th>Presentes</th>
                                <th>Ausentes</th>
                                <th>Retardos</th>
                                <th>% Asistencia</th>
                                <th>Rendimiento</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            datos.detalle_estudiantes.forEach(estudiante => {
                const rendimiento = estudiante.porcentaje_asistencia >= 90 ? 'Excelente' :
                                  estudiante.porcentaje_asistencia >= 80 ? 'Bueno' :
                                  estudiante.porcentaje_asistencia >= 70 ? 'Regular' : 'Deficiente';
                
                const rendimientoClass = estudiante.porcentaje_asistencia >= 90 ? 'excelente' :
                                       estudiante.porcentaje_asistencia >= 80 ? 'bueno' :
                                       estudiante.porcentaje_asistencia >= 70 ? 'regular' : 'deficiente';
                
                html += `
                    <tr>
                        <td data-label="Estudiante">${estudiante.estudiante_nombre}</td>
                        <td data-label="Email">${estudiante.estudiante_email}</td>
                        <td data-label="Total Asistencias">${estudiante.total_asistencias}</td>
                        <td data-label="Presentes">${estudiante.presentes}</td>
                        <td data-label="Ausentes">${estudiante.ausentes}</td>
                        <td data-label="Retardos">${estudiante.retardos}</td>
                        <td data-label="% Asistencia">${estudiante.porcentaje_asistencia}%</td>
                        <td data-label="Rendimiento"><span class="rendimiento-${rendimientoClass}">${rendimiento}</span></td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
    } else {
        // Reporte específico de materia (formato anterior)
        const porcentajePresentes = datos.totales?.total > 0 ? ((datos.totales.total_presentes / datos.totales.total) * 100).toFixed(1) : 0;
        
        html += `
            <div class="stats-grid">
                <div class="stat-item presente">
                    <span class="stat-number">${datos.totales?.total_presentes || 0}</span>
                    <span class="stat-label">Presentes (${porcentajePresentes}%)</span>
                </div>
                <div class="stat-item ausente">
                    <span class="stat-number">${datos.totales?.total_ausentes || 0}</span>
                    <span class="stat-label">Ausentes</span>
                </div>
                <div class="stat-item retardo">
                    <span class="stat-number">${datos.totales?.total_retardos || 0}</span>
                    <span class="stat-label">Retardos</span>
                </div>
                <div class="stat-item total">
                    <span class="stat-number">${datos.totales?.total_clases || 0}</span>
                    <span class="stat-label">Total Clases</span>
                </div>
            </div>
        `;
        
        if (datos.por_fecha && datos.por_fecha.length > 0) {
            html += '<h4>Historial por Fecha:</h4><div class="table-responsive-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Presentes</th><th>Ausentes</th><th>Retardos</th><th>Total</th><th>% Asistencia</th></tr></thead><tbody>';
            datos.por_fecha.forEach(dia => {
                const porcentaje = dia.total > 0 ? ((dia.presentes / dia.total) * 100).toFixed(1) : 0;
                html += `
                    <tr>
                        <td data-label="Fecha">${formatearFecha(dia.fecha)}</td>
                        <td data-label="Presentes">${dia.presentes}</td>
                        <td data-label="Ausentes">${dia.ausentes}</td>
                        <td data-label="Retardos">${dia.retardos}</td>
                        <td data-label="Total">${dia.total}</td>
                        <td data-label="% Asistencia">${porcentaje}%</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

window.cargarAsistencias = cargarAsistencias;
window.actualizarAsistencia = actualizarAsistencia;
window.eliminarAsistencia = eliminarAsistencia;
window.generarReportesAsistencia = generarReportesAsistencia;

// Función principal de exportación de asistencias
async function exportarAsistencias() {
    try {
        const materiaId = document.getElementById('materiaSelect').value;
        const fecha = document.getElementById('fechaAsistencia').value;
        const todasLasFechas = document.getElementById('todasLasFechas').checked;
        
        let url = '/admin/asistencias/exportar?';
        if (materiaId) url += `materia_id=${materiaId}&`;
        if (fecha && !todasLasFechas) url += `fecha=${fecha}&`;
        
        // Descargar el archivo
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al generar el archivo de exportación');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `asistencias_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        
        mostrarToast('✅ Asistencias exportadas exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando asistencias:', error);
        mostrarToast('Error al exportar asistencias. Intenta de nuevo.', 'error');
    }
}

// Exportar a Excel específico
async function exportarAsistenciasExcel() {
    try {
        const materiaId = document.getElementById('materiaSelect').value;
        const fecha = document.getElementById('fechaAsistencia').value;
        const todasLasFechas = document.getElementById('todasLasFechas').checked;
        
        let url = '/admin/asistencias/exportar/excel?';
        if (materiaId) url += `materia_id=${materiaId}&`;
        if (fecha && !todasLasFechas) url += `fecha=${fecha}&`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al generar el archivo Excel');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `asistencias_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        
        mostrarToast('✅ Asistencias exportadas a Excel exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando a Excel:', error);
        mostrarToast('Error al exportar a Excel. Intenta de nuevo.', 'error');
    }
}

// Exportar a PDF específico
async function exportarAsistenciasPDF() {
    try {
        const materiaId = document.getElementById('materiaSelect').value;
        const fecha = document.getElementById('fechaAsistencia').value;
        const todasLasFechas = document.getElementById('todasLasFechas').checked;
        
        let url = '/admin/asistencias/exportar/pdf?';
        if (materiaId) url += `materia_id=${materiaId}&`;
        if (fecha && !todasLasFechas) url += `fecha=${fecha}&`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al generar el archivo PDF');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `asistencias_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        
        mostrarToast('✅ Asistencias exportadas a PDF exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando a PDF:', error);
        mostrarToast('Error al exportar a PDF. Intenta de nuevo.', 'error');
    }
}

// Exponer funciones globalmente
window.exportarAsistencias = exportarAsistencias;
window.exportarAsistenciasExcel = exportarAsistenciasExcel;
window.exportarAsistenciasPDF = exportarAsistenciasPDF;


