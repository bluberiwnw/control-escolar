// asistencia.js
let estudiantesCargados = [];

document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion();
    mostrarInfoUsuario();
    mostrarFechaActual();
    await cargarMateriasSelect();
    document.getElementById('fechaAsistencia').valueAsDate = new Date();
});

async function cargarMateriasSelect() {
    const select = document.getElementById('materiaSelect');
    const token = localStorage.getItem('token');
    const res = await fetch(window.API_URL + '/materias', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const materias = await res.json();
    select.innerHTML = '<option value="">Seleccionar materia</option>';
    materias.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
    });
}

async function cargarListaAsistencia() {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!materiaId || !fecha) return;

    const tbody = document.getElementById('listaEstudiantes');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        // Obtener estudiantes (simulado: podrías tener un endpoint que devuelva los estudiantes de esa materia)
        // Por ahora usamos datos mock, pero idealmente deberías tener una relación.
        const estudiantes = [
            { id:1, matricula:'2020-1234', nombre:'Juan Pérez' },
            { id:2, matricula:'2020-1235', nombre:'María González' },
            { id:3, matricula:'2020-1236', nombre:'Carlos Rodríguez' },
            { id:4, matricula:'2020-1237', nombre:'Ana Martínez' },
        ];
        estudiantesCargados = estudiantes;

        // Obtener asistencias ya guardadas para hoy (opcional)
        const asistenciasRes = await fetch(`${window.API_URL}/asistencia/${materiaId}/${fecha}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const asistencias = asistenciasRes.ok ? await asistenciasRes.json() : [];

        const mapEstado = {};
        asistencias.forEach(a => mapEstado[a.estudiante_id] = a.estado);

        tbody.innerHTML = estudiantes.map((e, idx) => {
            const estado = mapEstado[e.id] || 'presente';
            return `
                <tr>
                    <td>${idx+1}</td>
                    <td>${e.matricula}</td>
                    <td>${e.nombre}</td>
                    <td>
                        <div class="estado-asistencia">
                            <button class="btn-estado ${estado==='presente'?'presente':''}" onclick="marcarAsistencia(this,${e.id},'presente')">P</button>
                            <button class="btn-estado ${estado==='ausente'?'ausente':''}" onclick="marcarAsistencia(this,${e.id},'ausente')">A</button>
                            <button class="btn-estado ${estado==='retardo'?'retardo':''}" onclick="marcarAsistencia(this,${e.id},'retardo')">R</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="alert alert-error">${error.message}</td></tr>`;
    }
}

function marcarAsistencia(btn, estudianteId, estado) {
    const container = btn.parentElement;
    container.querySelectorAll('.btn-estado').forEach(b => b.classList.remove('presente','ausente','retardo'));
    btn.classList.add(estado);
    // Guardar estado en un objeto temporal (podrías usar un dataset)
    btn.closest('tr').dataset.estado = estado;
    btn.closest('tr').dataset.estudianteId = estudianteId;
}

async function guardarAsistencia() {
    const materiaId = document.getElementById('materiaSelect').value;
    const fecha = document.getElementById('fechaAsistencia').value;
    if (!materiaId || !fecha) {
        mostrarAlerta('Selecciona materia y fecha', 'error');
        return;
    }

    const filas = document.querySelectorAll('#listaEstudiantes tr');
    const asistencias = [];
    filas.forEach(fila => {
        const estudianteId = fila.dataset.estudianteId;
        const estadoBtn = fila.querySelector('.btn-estado.presente, .btn-estado.ausente, .btn-estado.retardo');
        if (estudianteId && estadoBtn) {
            const estado = estadoBtn.classList.contains('presente') ? 'presente' :
                           estadoBtn.classList.contains('ausente') ? 'ausente' : 'retardo';
            asistencias.push({ materia_id: parseInt(materiaId), estudiante_id: parseInt(estudianteId), fecha, estado });
        }
    });

    if (asistencias.length === 0) {
        mostrarAlerta('No hay asistencias marcadas', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(window.API_URL + '/asistencia/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(asistencias)
        });
        if (!res.ok) throw new Error('Error al guardar');
        mostrarAlerta('Asistencias guardadas', 'success');
    } catch (error) {
        mostrarAlerta(error.message, 'error');
    }
}