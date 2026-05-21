const fs = require('fs');
const XLSX = require('xlsx');
const cheerio = require('cheerio');

const [excelPath, htmPath, outputPath] = process.argv.slice(2);

if (!excelPath || !htmPath || !outputPath) {
    console.error('Uso: node tools/generar_excel_calificaciones_completo.js <excel_origen.xlsx> <lista.htm> <salida.xlsx>');
    process.exit(1);
}

function normalize(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function cleanCell(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

const sourceWorkbook = XLSX.readFile(excelPath);
const sourceSheet = sourceWorkbook.Sheets[sourceWorkbook.SheetNames[0]];
const sourceRows = XLSX.utils.sheet_to_json(sourceSheet, { header: 1, defval: '', raw: false });
const headerIndex = sourceRows.findIndex(row => row.some(cell => cleanCell(cell) === 'Nombre completo'));

if (headerIndex < 0) {
    throw new Error('No se encontro la fila de encabezados del Excel origen.');
}

const headers = sourceRows[headerIndex];
const indexes = Object.fromEntries(headers.map((header, index) => [normalize(header), index]));
const students = sourceRows
    .slice(headerIndex + 1)
    .filter(row => cleanCell(row[indexes['nombre completo']]))
    .map(row => ({
        nombre: cleanCell(row[indexes['nombre completo']]),
        email: cleanCell(row[indexes['direccion de correo']])
    }));

const html = fs.readFileSync(htmPath, 'utf8');
const $ = cheerio.load(html);
const idsByName = new Map();

$('table').each((_, table) => {
    const headersText = $(table).find('tr').first().find('th,td')
        .map((__, cell) => cleanCell($(cell).text()))
        .get()
        .join('|')
        .toLowerCase();

    if (!headersText.includes('nombre de alumno') || !headersText.includes('id')) return;

    $(table).find('tr').slice(1).each((__, row) => {
        const cells = $(row).find('td,th').map((___, cell) => cleanCell($(cell).text())).get();
        if (cells.length >= 3 && cells[1] && cells[2]) {
            idsByName.set(cells[1].toUpperCase(), cells[2]);
        }
    });
});

const patterns = [
    [1, 0.8, 0.9, 0.7, 0.5],
    [0.8, 1, 0.7, 0.9, 0.8],
    [0.5, 0.8, 1, 0.7, 0.9],
    [0.7, 0.9, 0.8, 1, 0.5],
    [0.9, 0.7, 0.5, 0.8, 1],
    [1, 1, 1, 1, 1],
    [0.8, 0.8, 0.9, 0.9, 0.7],
    [0.7, 1, 0.8, 0.5, 0.9]
];

const outputRows = [[
    'Número de Registro',
    'Nombre de Alumno',
    'ID',
    'Status de Inscripción',
    'Nivel',
    'Créditos',
    'Email',
    'Tareas',
    'Exámenes',
    'Participación',
    'Proyectos',
    'Prácticas'
]];

students.forEach((student, index) => {
    outputRows.push([
        index + 1,
        student.nombre,
        idsByName.get(student.nombre.toUpperCase()) || '',
        '**Inscrito por Web**',
        'Licenciatura',
        '6.000',
        student.email,
        ...patterns[index % patterns.length]
    ]);
});

const outputWorkbook = XLSX.utils.book_new();
const outputSheet = XLSX.utils.aoa_to_sheet(outputRows);
outputSheet['!cols'] = [
    { wch: 18 }, { wch: 34 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 10 },
    { wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }
];
XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, 'Calificaciones');
XLSX.writeFile(outputWorkbook, outputPath);

console.log(`Excel generado: ${outputPath}`);
console.log(`Alumnos: ${students.length}`);
