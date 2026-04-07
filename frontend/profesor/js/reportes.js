document.addEventListener('DOMContentLoaded', async () => {
    verificarSesion(); mostrarInfoUsuario(); mostrarFechaActual();
    const materias = await apiRequest('/materias');
    const totalEst = materias.reduce((a,b)=>a+(b.estudiantes||0),0);
    const promedio = materias.length ? (materias.reduce((a,b)=>a+(b.promedio||0),0)/materias.length).toFixed(1) : 0;
    document.getElementById('reportesStats').innerHTML = `<div class="stat-card-profesor">Total estudiantes: ${totalEst}</div><div class="stat-card-profesor">Promedio general: ${promedio}</div>`;
});