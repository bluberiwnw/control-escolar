// calificaciones.js
document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMateriasCalificaciones();
    await cargarHistorialArchivos();
});

async function cargarMateriasCalificaciones() {
    const select = document.getElementById('materiaCalificaciones');
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:8000/materias', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const materias = await res.json();
    select.innerHTML = '<option value="">Seleccionar materia</option>';
    materias.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
    });
}

function cargarActividadesMateria() {
    // Podrías cargar actividades de la materia seleccionada si lo deseas
}

async function procesarArchivo(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const materiaId = document.getElementById('materiaCalificaciones').value;
    const tipo = document.getElementById('tipoCalificacion').value;

    if (!materiaId) {
        mostrarAlerta('Selecciona una materia', 'error');
        return;
    }

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
        mostrarAlerta('El archivo no debe superar 10MB', 'error');
        return;
    }

    // Validar extensión
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'pdf'].includes(extension)) {
        mostrarAlerta('Solo se permiten archivos Excel o PDF', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('materia_id', materiaId);
    formData.append('tipo', tipo);

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:8000/calificaciones/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Error al subir archivo');
        }

        const data = await res.json();
        mostrarAlerta('Archivo subido correctamente', 'success');
        await cargarHistorialArchivos();
        input.value = ''; // Limpiar input
    } catch (error) {
        mostrarAlerta(error.message, 'error');
        console.error(error);
    }
}

async function cargarHistorialArchivos() {
    const container = document.getElementById('archivosSubidos');
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:8000/calificaciones/archivos', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar historial');
        const archivos = await res.json();

        if (archivos.length === 0) {
            container.innerHTML = '<p style="color:var(--text-light);">No hay archivos subidos</p>';
            return;
        }

        container.innerHTML = archivos.map(a => {
            const fecha = new Date(a.fecha_subida).toLocaleDateString('es-ES');
            return `
                <div class="archivo-item">
                    <div class="archivo-info">
                        <h4>${a.nombre_archivo}</h4>
                        <p><i class="fas fa-tag"></i> ${a.tipo} · ${fecha}</p>
                    </div>
                    <div class="archivo-estado"><i class="fas fa-check-circle" style="color:var(--success);"></i> ${a.estado}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
    }
}