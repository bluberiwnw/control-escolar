const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
    console.error('Uso: node tools/generar_htm_lista_desde_excel.js <entrada.xlsx> <salida.htm>');
    process.exit(1);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function get(row, headers, labels) {
    const wanted = labels.map(normalizeKey);
    const idx = headers.findIndex((header) => wanted.some((label) => normalizeKey(header) === label));
    return idx >= 0 ? row[idx] : '';
}

function matriculaFromEmail(email, index) {
    const digits = String(email || '')
        .split('@')[0]
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return String(202600000 + ((digits + index) % 99999)).padStart(9, '0');
}

const workbook = XLSX.readFile(inputPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeKey(cell) === 'nombre completo') &&
    row.some((cell) => normalizeKey(cell).includes('direccion de correo'))
);

if (headerIndex < 0) {
    throw new Error('No se encontro la fila de encabezados esperada en el Excel.');
}

const headers = rows[headerIndex];
const seen = new Map();

rows.slice(headerIndex + 1).forEach((row, index) => {
    const nombreCompleto = String(get(row, headers, ['Nombre completo', 'Nombre de Alumno']) || '').trim();
    const nombre = String(get(row, headers, ['Nombre']) || '').trim();
    const apellidos = String(get(row, headers, ['Apellidos']) || '').trim();
    const email = String(get(row, headers, ['Direccion de correo', 'Dirección de correo', 'Email']) || '').trim();
    const displayName = nombreCompleto || [nombre, apellidos].filter(Boolean).join(' ');
    const key = normalizeKey(email || displayName);
    if (!key || seen.has(key)) return;
    seen.set(key, {
        nombre: displayName,
        email,
        matricula: matriculaFromEmail(email || displayName, index),
    });
});

const students = Array.from(seen.values());
const studentRows = students.map((student, index) => `
<tr>
<td class="dddefault">${index + 1}</td>
<td class="dddefault"><span class="fieldmediumtext">${escapeHtml(student.nombre)}</span></td>
<td class="dddefault"><span class="fieldmediumtext">${escapeHtml(student.matricula)}</span></td>
<td class="dddefault"><span class="fieldmediumtext">**Inscrito por Web**</span></td>
<td class="dddefault"><span class="fieldmediumtext">Licenciatura</span></td>
<td class="dddefault"><span class="fieldmediumtext">6.000</span></td>
<td class="dddead">&nbsp;</td>
<td class="dddefault"><span class="fieldmediumtext"><a href="mailto:${escapeHtml(student.email)}" target="${escapeHtml(student.nombre)}">Correo-e</a></span></td>
</tr>`).join('\n');

const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html lang="en" translate="no" class="notranslate">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Resumen de lista de clase</title>
</head>
<body>
<div class="pagebodydiv">
<table class="datadisplaytable" summary="Esta tabla despliega los atributos de curso.">
<caption class="captiontext">Información de Curso</caption>
<tbody>
<tr><th class="ddlabel" scope="row">Curso:</th><td class="dddefault">MODELOS DE DESARROLLO WEB - C1202625</td></tr>
<tr><th class="ddlabel" scope="row">NRC:</th><td class="dddefault">49097</td></tr>
<tr><th class="ddlabel" scope="row">Periodo:</th><td class="dddefault">PRIMAVERA 2026</td></tr>
<tr><th class="ddlabel" scope="row">Status:</th><td class="dddefault">Activo</td></tr>
</tbody></table>
<br>
<table class="datadisplaytable" summary="Esta tabla despliega una lista de alumnos inscritos para el curso, se provee información de resumen para cada alumno." width="100%">
<caption class="captiontext">Resumen de Lista de Clase</caption>
<tbody>
<tr>
<th class="ddheader" scope="col">Número de<br>Registro</th>
<th class="ddheader" scope="col">Nombre de Alumno</th>
<th class="ddheader" scope="col">ID</th>
<th class="ddheader" scope="col"><abbr title="Status de Inscripción">Status de Inscripción</abbr></th>
<th class="ddheader" scope="col">Nivel</th>
<th class="ddheader" scope="col">Créditos</th>
<th class="ddheader" scope="col">Detalle de Calificaciones</th>
<td class="dddead">&nbsp;</td>
</tr>
${studentRows}
</tbody></table>
</div>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`HTM generado: ${outputPath}`);
console.log(`Alumnos: ${students.length}`);
