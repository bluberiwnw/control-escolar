document.addEventListener(''DOMContentLoaded'', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const materias = await apiRequest(''/materias'');
    const container = document.getElementById(''materiasContainer'');
    container.innerHTML = materias.map(m => `
        <div class="course-card course-card--elevated">
            <div class="course-header" style="background:${m.color || ''linear-gradient(135deg,#6366f1,#0ea5e9)''}"><h3>${m.nombre}</h3><p>${m.clave}</p></div>
            <div class="course-body">
                <div class="course-detail"><i class="fas fa-clock"></i> ${m.horario || ''Horario no definido''}</div>
                <div class="course-detail"><i class="fas fa-user-check"></i> ${m.estudiantes || 0} activos</div>
                <div class="course-detail"><i class="fas fa-star"></i> Promedio: ${m.promedio ?? ''N/A''}</div>
            </div>
            <div class="course-footer"><button class="btn btn-primary btn-sm" onclick="verMateria(${m.id})">Ver detalles</button></div>
        </div>
    `).join('');
});
function verMateria(id) { localStorage.setItem(''materiaActual'', id); window.location.href = ''actividades.html''; }
window.verMateria = verMateria;