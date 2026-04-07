const XLSX = require('xlsx');
const pool = require('../database/connection');

async function procesarExcelCalificaciones(filePath, materiaId) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  const resultados = { exitosos: 0, errores: [] };

  for (const row of data) {
    const matricula = row['Matrícula'] || row['matricula'];
    const nombre = row['Nombre'] || row['nombre'];
    const calificacion = row['Calificación'] || row['calificacion'];

    if (!matricula || !nombre || calificacion === undefined) {
      resultados.errores.push(`Fila inválida: ${JSON.stringify(row)}`);
      continue;
    }
    const estudianteRes = await pool.query('SELECT id FROM estudiantes WHERE matricula = $1', [matricula.toString()]);
    if (estudianteRes.rows.length === 0) {
      resultados.errores.push(`Matrícula no encontrada: ${matricula}`);
      continue;
    }
    const estudianteId = estudianteRes.rows[0].id;
    await pool.query(
      `INSERT INTO calificaciones_finales (materia_id, estudiante_id, calificacion)
       VALUES ($1, $2, $3)
       ON CONFLICT (materia_id, estudiante_id) DO UPDATE SET calificacion = EXCLUDED.calificacion`,
      [materiaId, estudianteId, parseFloat(calificacion)]
    );
    resultados.exitosos++;
  }
  return resultados;
}

module.exports = { procesarExcelCalificaciones };