const XLSX = require('xlsx');
const pool = require('../database/connection');

const REQUIRED_HEADERS = ['Materia', 'Nombre', 'Calificacion'];

function validateExactColumns(firstRow) {
  if (!firstRow || typeof firstRow !== 'object') {
    return { ok: false, message: 'Formato inválido' };
  }
  const keys = Object.keys(firstRow);
  if (keys.length !== REQUIRED_HEADERS.length) {
    return { ok: false, message: 'Formato inválido' };
  }
  const set = new Set(keys);
  for (const h of REQUIRED_HEADERS) {
    if (!set.has(h)) {
      return { ok: false, message: 'Formato inválido' };
    }
  }
  return { ok: true };
}

function normalizeName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Procesa Excel con columnas exactas Materia | Nombre | Calificacion.
 * Asocia cada fila a materias del profesor y estudiantes por nombre.
 */
async function procesarExcelCalificaciones(filePath, profesorId) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  const resultados = { exitosos: 0, errores: [] };

  if (data.length === 0) {
    resultados.errores.push('El archivo no contiene filas de datos');
    return resultados;
  }

  const headerCheck = validateExactColumns(data[0]);
  if (!headerCheck.ok) {
    resultados.errores.push(headerCheck.message);
    return resultados;
  }

  const materiasRes = await pool.query(
    'SELECT id, nombre FROM materias WHERE profesor_id = $1',
    [profesorId]
  );
  const materiaByNorm = new Map();
  for (const m of materiasRes.rows) {
    materiaByNorm.set(normalizeName(m.nombre), m.id);
  }

  for (const row of data) {
    const mNombre = row.Materia;
    const eNombre = row.Nombre;
    const calRaw = row.Calificacion;
    if (mNombre === undefined || eNombre === undefined || calRaw === undefined) {
      resultados.errores.push(`Fila incompleta: ${JSON.stringify(row)}`);
      continue;
    }
    const materiaId = materiaByNorm.get(normalizeName(mNombre));
    if (!materiaId) {
      resultados.errores.push(`Materia no encontrada o no asignada a usted: ${mNombre}`);
      continue;
    }
    const estRes = await pool.query(
      `SELECT id FROM estudiantes WHERE LOWER(TRIM(nombre)) = $1`,
      [normalizeName(eNombre)]
    );
    if (estRes.rows.length === 0) {
      resultados.errores.push(`Alumno no encontrado: ${eNombre}`);
      continue;
    }
    if (estRes.rows.length > 1) {
      resultados.errores.push(`Nombre duplicado en BD, refine el nombre: ${eNombre}`);
      continue;
    }
    const estudianteId = estRes.rows[0].id;
    const calificacion = parseFloat(calRaw);
    if (Number.isNaN(calificacion)) {
      resultados.errores.push(`Calificación no numérica para ${eNombre}`);
      continue;
    }

    await pool.query(
      `INSERT INTO calificaciones_finales (materia_id, estudiante_id, calificacion)
       VALUES ($1, $2, $3)
       ON CONFLICT (materia_id, estudiante_id) DO UPDATE SET calificacion = EXCLUDED.calificacion`,
      [materiaId, estudianteId, calificacion]
    );
    resultados.exitosos++;
  }

  return resultados;
}

module.exports = { procesarExcelCalificaciones, validateExactColumns, REQUIRED_HEADERS };
