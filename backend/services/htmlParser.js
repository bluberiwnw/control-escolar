const cheerio = require('cheerio');

class HtmlParser {
    static parseStudentList(htmlContent) {
        const $ = cheerio.load(htmlContent);
        const students = [];
        
        // Buscar la tabla con el resumen de lista de clase
        $('table.datadisplaytable').each((i, table) => {
            const $table = $(table);
            const caption = $table.find('caption').text().trim();
            
            if (caption.includes('Resumen de Lista de Clase')) {
                // Extraer información del curso
                const courseInfo = this.extractCourseInfo($);
                
                // Extraer alumnos de la tabla
                $table.find('tr').each((rowIndex, row) => {
                    const $row = $(row);
                    const cells = $row.find('td');
                    
                    // Skip header row and empty rows
                    if (cells.length >= 6 && !$row.hasClass('ddheader')) {
                        const studentData = this.extractStudentData($, $row, courseInfo);
                        if (studentData) {
                            students.push(studentData);
                        }
                    }
                });
            }
        });
        
        return students;
    }
    
    static extractCourseInfo($) {
        const courseInfo = {};
        
        // Extraer información del curso
        $('table.datadisplaytable').each((i, table) => {
            const $table = $(table);
            const caption = $table.find('caption').text().trim();
            
            if (caption.includes('Información de Curso')) {
                $table.find('tr').each((j, row) => {
                    const $row = $(row);
                    const th = $row.find('th.ddlabel').text().trim();
                    const td = $row.find('td.dddefault').text().trim();
                    
                    if (th.includes('Visión y Animación')) {
                        courseInfo.nombre = td.split(' - ')[0].trim();
                        courseInfo.clave = td.split(' - ')[1]?.trim() || '';
                    } else if (th.includes('NRC')) {
                        courseInfo.nrc = td;
                    } else if (th.includes('Duración')) {
                        courseInfo.duracion = td;
                    }
                });
            }
        });
        
        return courseInfo;
    }
    
    static extractStudentData($, $row, courseInfo) {
        const cells = $row.find('td');
        
        if (cells.length < 6) return null;
        
        const nombreCompleto = $(cells[1]).find('span.fieldmediumtext').text().trim();
        const id = $(cells[2]).find('span.fieldmediumtext').text().trim();
        const status = $(cells[3]).find('span.fieldmediumtext').text().trim();
        const nivel = $(cells[4]).find('span.fieldmediumtext').text().trim();
        const creditos = $(cells[5]).find('span.fieldmediumtext').text().trim();
        
        // Extraer email si existe
        const emailLink = $(cells[7]).find('a[href^="mailto:"]');
        const email = emailLink.length > 0 ? emailLink.attr('href').replace('mailto:', '') : '';
        
        // Dividir nombre en nombre y apellidos
        const nombreParts = nombreCompleto.split(',');
        const apellidos = nombreParts[0]?.trim() || '';
        const nombre = nombreParts[1]?.trim() || '';
        
        return {
            numero_registro: $(cells[0]).text().trim(),
            nombre_completo: nombreCompleto,
            nombre: nombre,
            apellidos: apellidos,
            email: email,
            id: id,
            status: status,
            nivel: nivel,
            creditos: parseFloat(creditos) || 0,
            curso: courseInfo.nombre || '',
            clave_curso: courseInfo.clave || '',
            nrc: courseInfo.nrc || '',
            // Campos para calificaciones
            participaciones: 0,
            tareas: 0,
            actividades: 0,
            examenes: 0,
            calificacion_final: 0,
            porcentaje_final: 0
        };
    }
    
    static convertToExcelFormat(students) {
        const excelData = [
            [
                'Nombre completo',
                'Nombre',
                'Apellidos',
                'Dirección de correo',
                'Participaciones',
                'Tareas',
                'Actividades',
                'Examenes',
                'Calificaciones',
                'Porcentaje Final'
            ]
        ];
        
        students.forEach(student => {
            excelData.push([
                student.nombre_completo,
                student.nombre,
                student.apellidos,
                student.email,
                student.participaciones,
                student.tareas,
                student.actividades,
                student.examenes,
                student.calificacion_final,
                student.porcentaje_final
            ]);
        });
        
        return excelData;
    }
    
    static calculateGrade(participaciones, tareas, actividades, examenes) {
        // Convertir de 100 puntos a escala de 10 puntos
        const total = participaciones + tareas + actividades + examenes;
        let calificacion = total / 10;
        
        // Aplicar redondeo: si es .5 o más, asciende a la siguiente calificación
        if (calificacion % 1 >= 0.5) {
            calificacion = Math.ceil(calificacion);
        } else {
            calificacion = Math.floor(calificacion);
        }
        
        // Asegurar que esté en el rango de 5 a 10
        calificacion = Math.max(5, Math.min(10, calificacion));
        
        return calificacion;
    }
}

module.exports = HtmlParser;
