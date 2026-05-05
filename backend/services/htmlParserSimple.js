class HtmlParserSimple {
    static parseStudentList(htmlContent) {
        const students = [];
        
        try {
            console.log('Iniciando parseStudentList...');
            
            // Buscar cualquier tabla que contenga información de estudiantes
            const tableRegex = /<table[^>]*class="datadisplaytable"[^>]*>[\s\S]*?<\/table>/gi;
            const tables = htmlContent.match(tableRegex);
            
            if (!tables) {
                console.warn('No se encontraron tablas con clase datadisplaytable');
                // Intentar buscar tablas genéricas
                const genericTableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
                const genericTables = htmlContent.match(genericTableRegex);
                if (genericTables) {
                    console.log('Buscando en tablas genéricas...');
                    return this.parseGenericTables(genericTables, htmlContent);
                }
                return students;
            }
            
            console.log(`Encontradas ${tables.length} tablas datadisplaytable`);
            
            for (const table of tables) {
                // Buscar cualquier tabla que tenga filas con datos de estudiantes
                if (table.includes('Lista') || table.includes('Estudiante') || table.includes('Alumno') || 
                    table.includes('Nombre') || table.includes('Matrícula') || table.includes('ID')) {
                    
                    console.log('Procesando tabla con información de estudiantes...');
                    
                    // Extraer información del curso
                    const courseInfo = this.extractCourseInfoSimple(htmlContent);
                    
                    // Extraer filas de la tabla
                    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
                    const rows = table.match(rowRegex);
                    
                    console.log(`Encontradas ${rows ? rows.length : 0} filas en la tabla`);
                    
                    if (rows && rows.length > 1) { // Al menos el header + 1 fila de datos
                        for (let i = 1; i < rows.length; i++) { // Skip header row
                            const studentData = this.extractStudentDataSimple(rows[i], courseInfo);
                            if (studentData) {
                                students.push(studentData);
                                console.log(`Estudiante extraído: ${studentData.nombre_completo}`);
                            }
                        }
                    }
                }
            }
            
            console.log(`Total estudiantes extraídos: ${students.length}`);
            
        } catch (error) {
            console.error('Error parsing HTML:', error);
        }
        
        return students;
    }
    
    static parseGenericTables(tables, htmlContent) {
        const students = [];
        
        try {
            const courseInfo = this.extractCourseInfoSimple(htmlContent);
            
            for (const table of tables) {
                // Buscar filas que contengan patrones de nombres y IDs
                const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
                const rows = table.match(rowRegex);
                
                if (rows && rows.length > 1) {
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        
                        // Buscar patrones de nombres en formato BUAP
                        if (row.includes('fieldmediumtext') || 
                            row.match(/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+,\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/)) {
                             
                            const studentData = this.extractStudentDataSimple(row, courseInfo);
                            if (studentData) {
                                students.push(studentData);
                                console.log(`Estudiante extraído de tabla genérica: ${studentData.nombre_completo}`);
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Error parsing generic tables:', error);
        }
        
        return students;
    }
    
    static extractCourseInfoSimple(htmlContent) {
        const courseInfo = {};
        
        try {
            console.log('Extrayendo información del curso...');
            
            // Extraer nombre del curso del formato BUAP real
            const courseNameMatch = htmlContent.match(/<th[^>]*class="ddlabel"[^>]*scope="row"[^>]*>([^<]+)<\/th>[\s\S]*?<td[^>]*class="dddefault"[^>]*>([^<]+)<\/td>/i);
            if (courseNameMatch) {
                const courseText = courseNameMatch[2].trim();
                console.log('Texto del curso encontrado:', courseText);
                
                // Formato: "Visión y Animación por Computadora - ICCS 616 001"
                const parts = courseText.split(' - ');
                courseInfo.nombre = parts[0]?.trim() || courseText;
                courseInfo.clave = parts[1]?.trim() || '';
                
                console.log('Nombre extraído:', courseInfo.nombre);
                console.log('Clave extraída:', courseInfo.clave);
            }
            
            // Extraer NRC del formato BUAP real
            const nrcMatch = htmlContent.match(/<acronym[^>]*>NRC:<\/acronym>[\s\S]*?<td[^>]*class="dddefault"[^>]*>([^<]+)<\/td>/i);
            if (nrcMatch) {
                courseInfo.nrc = nrcMatch[1].trim();
                console.log('NRC extraído:', courseInfo.nrc);
            }
            
            // Extraer duración del formato BUAP real
            const durationMatch = htmlContent.match(/<th[^>]*class="ddlabel"[^>]*>Duración:<\/th>[\s\S]*?<td[^>]*class="dddefault"[^>]*>([^<]+)<\/td>/i);
            if (durationMatch) {
                courseInfo.duracion = durationMatch[1].trim();
                console.log('Duración extraída:', courseInfo.duracion);
            }
            
            // Si no se encontró información, usar valores por defecto
            if (!courseInfo.nombre) {
                courseInfo.nombre = 'Curso sin nombre';
                courseInfo.clave = 'SIN-CLAVE';
                courseInfo.nrc = '00000';
                courseInfo.duracion = '16 semanas';
                console.log('Usando valores por defecto para el curso');
            }
            
        } catch (error) {
            console.error('Error extracting course info:', error);
            // Valores por defecto en caso de error
            courseInfo.nombre = 'Curso sin nombre';
            courseInfo.clave = 'SIN-CLAVE';
            courseInfo.nrc = '00000';
            courseInfo.duracion = '16 semanas';
        }
        
        return courseInfo;
    }
    
    static extractStudentDataSimple(rowHtml, courseInfo) {
        try {
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = rowHtml.match(cellRegex);
            
            if (!cells || cells.length < 7) return null;
            
            // Extraer texto de cada celda (manejo específico para formato BUAP)
            const getCellText = (cellHtml) => {
                // Primero remover spans y luego extraer texto
                let text = cellHtml.replace(/<span[^>]*class="fieldmediumtext"[^>]*>/gi, '');
                text = text.replace(/<\/span>/gi, '');
                text = text.replace(/<[^>]*>/g, '').trim();
                return text;
            };
            
            const numeroRegistro = getCellText(cells[0]);
            const nombreCompleto = getCellText(cells[1]);
            const id = getCellText(cells[2]);
            const status = getCellText(cells[3]);
            const nivel = getCellText(cells[4]);
            const creditos = getCellText(cells[5]);
            
            // Extraer email del formato BUAP real
            let email = '';
            if (cells.length > 7) {
                // Buscar enlace mailto en las celdas
                for (let i = 6; i < cells.length; i++) {
                    const emailMatch = cells[i].match(/mailto:([^"\s]+)/);
                    if (emailMatch) {
                        email = emailMatch[1];
                        break;
                    }
                }
            }
            
            // Limpiar el nombre (formato BUAP: "APELLIDOS, NOMBRE ")
            let nombreLimpiado = nombreCompleto.trim();
            if (nombreLimpiado.endsWith(' ')) {
                nombreLimpiado = nombreLimpiado.slice(0, -1);
            }
            
            // Dividir nombre en nombre y apellidos
            const nombreParts = nombreLimpiado.split(',');
            const apellidos = nombreParts[0]?.trim() || '';
            const nombre = nombreParts[1]?.trim() || '';
            
            // Limpiar status (remover asteriscos y normalizar)
            let statusLimpiado = status.replace(/\*\*/g, '').trim();
            if (statusLimpiado === 'Inscrito por Web') {
                statusLimpiado = 'Activo';
            }
            
            return {
                numero_registro: numeroRegistro,
                nombre_completo: nombreLimpiado,
                nombre: nombre,
                apellidos: apellidos,
                email: email,
                id: id,
                status: statusLimpiado,
                nivel: nivel,
                creditos: parseFloat(creditos) || 0,
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
