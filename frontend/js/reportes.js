// GESTIÓN DE REPORTES Y ESTADÍSTICAS

const estudiantesRendimiento = [
    { matricula: '2020-1234', nombre: 'Juan Carlos Pérez Gómez', tareas: 9.2, proyectos: 8.5, examenes: 8.8, promedio: 8.8, asistencia: 95 },
    { matricula: '2020-1235', nombre: 'María Fernanda González López', tareas: 9.5, proyectos: 9.0, examenes: 9.2, promedio: 9.2, asistencia: 98 },
    { matricula: '2020-1236', nombre: 'Carlos Alberto Rodríguez Sánchez', tareas: 7.8, proyectos: 8.0, examenes: 7.5, promedio: 7.8, asistencia: 85 },
    { matricula: '2020-1237', nombre: 'Ana Laura Martínez Hernández', tareas: 8.5, proyectos: 9.2, examenes: 8.9, promedio: 8.9, asistencia: 92 },
    { matricula: '2020-1238', nombre: 'Luis Miguel Torres Rivera', tareas: 6.5, proyectos: 7.0, examenes: 6.8, promedio: 6.8, asistencia: 78 }
];

function cargarMateriasReporte() {
    const select = document.getElementById('materiaReporte');
    if (!select) return;
    
    const materias = obtenerMateriasProfesor();
    
    select.innerHTML = '<option value="todas">Todas las materias</option>';
    materias.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.nombre} (${m.clave})</option>`;
    });
}

function cargarReporteMateria() {
    const materiaId = document.getElementById('materiaReporte').value;
    
    // Actualizar estadísticas (simulado)
    if (materiaId === 'todas') {
        document.getElementById('promedioGeneral').textContent = '8.5';
        document.getElementById('indiceAprobacion').textContent = '92%';
        document.getElementById('asistenciaPromedio').textContent = '88%';
        document.getElementById('bajasCurso').textContent = '3';
    } else {
        // Datos específicos por materia
        const materias = obtenerMateriasProfesor();
        const materia = materias.find(m => m.id == materiaId);
        
        if (materia) {
            document.getElementById('promedioGeneral').textContent = materia.promedio;
            document.getElementById('indiceAprobacion').textContent = 
                materia.nombre === 'Programación I' ? '89%' : 
                materia.nombre === 'Bases de Datos' ? '91%' : '88%';
            document.getElementById('asistenciaPromedio').textContent = 
                materia.nombre === 'Programación I' ? '87%' : 
                materia.nombre === 'Bases de Datos' ? '92%' : '85%';
            document.getElementById('bajasCurso').textContent = materia.bajas;
        }
    }
    
    cargarTablaRendimiento();
}

function cargarTablaRendimiento() {
    const tbody = document.getElementById('tablaRendimiento');
    if (!tbody) return;
    
    tbody.innerHTML = estudiantesRendimiento.map(est => {
        const promedioColor = est.promedio >= 8 ? 'var(--success)' : est.promedio >= 7 ? 'var(--warning)' : 'var(--danger)';
        const asistenciaColor = est.asistencia >= 90 ? 'var(--success)' : est.asistencia >= 80 ? 'var(--warning)' : 'var(--danger)';
        
        return `
            <tr>
                <td>${est.matricula}</td>
                <td>${est.nombre}</td>
                <td>${est.tareas}</td>
                <td>${est.proyectos}</td>
                <td>${est.examenes}</td>
                <td style="color: ${promedioColor}; font-weight: bold;">${est.promedio}</td>
                <td>
                    <span style="color: ${asistenciaColor}; font-weight: bold;">${est.asistencia}%</span>
                </td>
            </tr>
        `;
    }).join('');
}

function exportarReporte() {
    const materia = document.getElementById('materiaReporte').selectedOptions[0].text;
    const periodo = document.getElementById('periodoReporte').selectedOptions[0].text;
    
    mostrarAlerta(`Exportando reporte de ${materia} - ${periodo}`, 'success');
    // Aquí iría la lógica real de exportación
}

document.addEventListener('DOMContentLoaded', () => {
    verificarSesion();
    cargarMateriasReporte();
    cargarReporteMateria();
    cargarTablaRendimiento();
});