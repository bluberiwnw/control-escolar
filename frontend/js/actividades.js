// actividades.js
let filtroActual = 'todas';
let materiaFiltroActual = 'todas';

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMateriasEnSelect();
    await cargarActividades();
});

async function cargarMateriasEnSelect() {
    const selectMateria = document.getElementById('actividadMateria');
    const selectFiltro = document.getElementById('materiaFiltro');
    if (!selectMateria || !selectFiltro) return;

    const token = localStorage.getItem('token');
    const res = await fetch(window.API_URL + '/materias', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const materias = await res.json();

    selectMateria.innerHTML = '<option value="">Seleccionar materia</option>';
    selectFiltro.innerHTML = '<option value="todas">Todas las materias</option>';

    materias.forEach(m => {
        selectMateria.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
        selectFiltro.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
    });
}

async function cargarActividades() {
    const container = document.getElementById('actividadesContainer');
    container.innerHTML = '<div class="spinner"></div>';

    try {
        const token = localStorage.getItem('token');
        let url = window.API_URL + '/actividades';
        if (materiaFiltroActual !== 'todas') {
            url += `?materia_id=${materiaFiltroActual}`;
        }
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        let actividades = await res.json();

        // Filtrar por tipo en el cliente (por simplicidad)
        if (filtroActual !== 'todas') {
            actividades = actividades.filter(a => a.tipo === filtroActual);
        }

        if (actividades.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No hay actividades</div>';
            return;
        }

        // Agrupar por materia (opcional)
        const materias = await (await fetch(window.API_URL + '/materias', {
            headers: { 'Authorization': `Bearer ${token}` }
        })).json();

        let html = '';
        materias.forEach(materia => {
            const actsMateria = actividades.filter(a => a.materia_id === materia.id);
            if (actsMateria.length === 0) return;
            html += `
                <div class="materia-header" style="background: ${materia.color}; padding: 12px 20px; border-radius: 8px; color: white; margin: 20px 0 15px; display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="margin:0; font-size: 1.2rem;">${materia.nombre}</h3>
                    <span style="font-size:0.9rem; opacity:0.9;">${materia.clave}</span>
                </div>
            `;
            actsMateria.forEach(a => {
                const fecha = new Date(a.fecha_entrega).toLocaleDateString('es-ES');
                const icono = { tarea: '📝', proyecto: '🚀', examen: '📋' }[a.tipo];
                html += `
                    <div class="actividad-card" style="border-left-color: ${materia.color}">
                        <div class="actividad-tipo">${icono} ${a.tipo.toUpperCase()}</div>
                        <div class="actividad-titulo">${a.titulo}</div>
                        <div class="actividad-descripcion">${a.descripcion}</div>
                        <div class="actividad-meta">
                            <span><i class="fas fa-calendar"></i> Entrega: ${fecha}</span>
                            <span><i class="fas fa-star"></i> Valor: ${a.valor} pts</span>
                        </div>
                        <div style="margin-top:15px; display:flex; gap:10px; justify-content:flex-end;">
                            <button class="btn-course" onclick="editarActividad(${a.id})"><i class="fas fa-edit"></i> Editar</button>
                            <button class="btn-course" style="border-color:var(--danger);color:var(--danger);" onclick="eliminarActividad(${a.id})"><i class="fas fa-trash"></i> Eliminar</button>
                        </div>
                    </div>
                `;
            });
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
    }
}

function filtrarActividades(tipo) {
    filtroActual = tipo;
    document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    cargarActividades();
}

function filtrarPorMateria() {
    materiaFiltroActual = document.getElementById('materiaFiltro').value;
    cargarActividades();
}

function mostrarModalActividad() {
    document.getElementById('actividadModal').style.display = 'flex';
    document.getElementById('actividadFecha').valueAsDate = new Date();
}

function cerrarModalActividad() {
    document.getElementById('actividadModal').style.display = 'none';
    document.getElementById('actividadForm').reset();
}

async function guardarActividad() {
    const materia_id = document.getElementById('actividadMateria').value;
    const tipo = document.getElementById('actividadTipo').value;
    const titulo = document.getElementById('actividadTitulo').value;
    const descripcion = document.getElementById('actividadDescripcion').value;
    const fecha_entrega = document.getElementById('actividadFecha').value;
    const valor = document.getElementById('actividadValor').value;

    if (!materia_id || !tipo || !titulo || !descripcion || !fecha_entrega || !valor) {
        mostrarAlerta('Todos los campos son obligatorios', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(window.API_URL + '/actividades', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ materia_id, tipo, titulo, descripcion, fecha_entrega, valor })
        });
        if (!res.ok) throw new Error('Error al guardar');
        mostrarAlerta('Actividad creada', 'success');
        cerrarModalActividad();
        cargarActividades();
    } catch (error) {
        mostrarAlerta(error.message, 'error');
    }
}

async function eliminarActividad(id) {
    if (!confirm('¿Eliminar actividad?')) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/actividades/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al eliminar');
        mostrarAlerta('Actividad eliminada', 'success');
        cargarActividades();
    } catch (error) {
        mostrarAlerta(error.message, 'error');
    }
}