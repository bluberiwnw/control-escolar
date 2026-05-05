class HtmlParserSimple {
    static parseStudentList(htmlContent) {
        const students = [];
        
        try {
            // Buscar la tabla con el resumen de lista de clase usando expresiones regulares
            const tableRegex = /<table[^>]*class="datadisplaytable"[^>]*>[\s\S]*?<\/table>/gi;
            const tables = htmlContent.match(tableRegex);
            
            if (!tables) {
                console.warn('No se encontraron tablas con clase datadisplaytable');
                return students;
            }
            
            for (const table of tables) {
                if (table.includes('Resumen de Lista de Clase')) {
                    // Extraer información del curso
                    const courseInfo = this.extractCourseInfoSimple(htmlContent);
                    
                    // Extraer filas de la tabla
                    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
                    const rows = table.match(rowRegex);
                    
                    if (rows) {
                        for (let i = 1; i < rows.length; i++) { // Skip header row
                            const studentData = this.extractStudentDataSimple(rows[i], courseInfo);
                            if (studentData) {
                                students.push(studentData);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing HTML:', error);
        }
        
        return students;
    }
    
    static extractCourseInfoSimple(htmlContent) {
        const courseInfo = {};
        
        try {
            // Extraer nombre del curso
            const courseNameMatch = htmlContent.match(/Visión y Animación[\s\S]*?<\/td>[\s\S]*?<td[^>]*class="dddefault"[^>]*>([^<]+)<\/td>/i);
            if (courseNameMatch) {
                const courseText = courseNameMatch[1].trim();
                const parts = courseText.split(' - ');
                courseInfo.nombre = parts[0]?.trim() || '';
                courseInfo.clave = parts[1]?.trim() || '';
            }
            
            // Extraer NRC
            const nrcMatch = htmlContent.match(/NRC[\s\S]*?<\/td>[\s\S]*?<td[^>]*class="dddefault"[^>]*>([^<]+)<\/td>/i);
            if (nrcMatch) {
                courseInfo.nrc = nrcMatch[1].trim();
            }
            
            // Extraer duración
            const durationMatch = htmlContent.match(/Duración[\s\S]*?<\/td>[\s\S]*?<td[^>]*class="dddefault"[^>]*>([^<]+)<\/td>/i);
            if (durationMatch) {
                courseInfo.duracion = durationMatch[1].trim();
            }
        } catch (error) {
            console.error('Error extracting course info:', error);
        }
        
        return courseInfo;
    }
    
    static extractStudentDataSimple(rowHtml, courseInfo) {
        try {
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = rowHtml.match(cellRegex);
            
            if (!cells || cells.length < 6) return null;
            
            // Extraer texto de cada celda
            const getCellText = (cellHtml) => {
                const text = cellHtml.replace(/<[^>]*>/g, '').trim();
                return text;
            };
            
            const numeroRegistro = getCellText(cells[0]);
            const nombreCompleto = getCellText(cells[1]);
            const id = getCellText(cells[2]);
            const status = getCellText(cells[3]);
            const nivel = getCellText(cells[4]);
            const creditos = getCellText(cells[5]);
            
            // Extraer email si existe
            let email = '';
            if (cells.length > 7) {
                const emailMatch = cells[7].match(/mailto:([^"]+)/);
                if (emailMatch) {
                    email = emailMatch[1];
                }
            }
            
            // Extraer información adicional si existe
            let carrera = '';
            let planEstudios = '';
            let campus = '';
            
            // Buscar información adicional en celdas extras
            for (let i = 8; i < cells.length; i++) {
                const cellText = getCellText(cells[i]);
                if (cellText.includes('Carrera:')) {
                    carrera = cellText.replace('Carrera:', '').trim();
                } else if (cellText.includes('Plan:')) {
                    planEstudios = cellText.replace('Plan:', '').trim();
                } else if (cellText.includes('Campus:')) {
                    campus = cellText.replace('Campus:', '').trim();
                }
            }
            
            // Dividir nombre en nombre y apellidos
            const nombreParts = nombreCompleto.split(',');
            const apellidos = nombreParts[0]?.trim() || '';
            const nombre = nombreParts[1]?.trim() || '';
            
            return {
                numero_registro: numeroRegistro,
                nombre_completo: nombreCompleto,
                nombre: nombre,
                apellidos: apellidos,
                email: email,
                id: id,
                status: status,
                nivel: nivel,
                creditos: parseFloat(creditos) || 0,
                carrera: carrera,
                plan_estudios: planEstudios,
                campus: campus,
                curso: courseInfo.nombre || '',
                clave_curso: courseInfo.clave || '',
                nrc: courseInfo.nrc || '',
                duracion: courseInfo.duracion || '',
                // Campos para calificaciones (inicializados en 0)
                participaciones: 0,
                tareas: 0,
                actividades: 0,
                examenes: 0,
                calificacion_final: 0,
                porcentaje_final: 0
            };
        } catch (error) {
            console.error('Error extracting student data:', error);
            return null;
        }
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

module.exports = HtmlParserSimple;
