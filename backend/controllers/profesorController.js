const pool = require('../database/connection');

const profesorController = {
    async getMaterias(req, res) {
        try {
            const result = await pool.query('SELECT * FROM materias WHERE profesor_id = $1 ORDER BY nombre', [req.usuario.id]);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

        async getEstadisticas(req, res) {
            try {
                const profesorId = req.usuario.id;
                // Materias del profesor
                const materias = await pool.query('SELECT id, estudiantes, promedio FROM materias WHERE profesor_id = $1', [profesorId]);
                const totalMaterias = materias.rows.length;
                const totalEstudiantes = materias.rows.reduce((sum, m) => sum + (m.estudiantes || 0), 0);
                const promedioGeneral = materias.rows.length
                    ? (materias.rows.reduce((sum, m) => sum + (m.promedio || 0), 0) / materias.rows.length).toFixed(1)
                    : 0;
                // Actividades activas (fecha_entrega >= hoy)
                const activas = await pool.query(`
                    SELECT COUNT(*) FROM actividades a
                    JOIN materias m ON a.materia_id = m.id
                    WHERE m.profesor_id = $1 AND a.fecha_entrega >= CURRENT_DATE
                `, [profesorId]);
                res.json({
                    totalMaterias,
                    totalEstudiantes,
                    promedioGeneral,
                    actividadesActivas: parseInt(activas.rows[0].count)
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        },

    async getEvolucionCalificaciones(req, res) {
        try {
            const profesorId = req.usuario.id;
            const result = await pool.query(
                `SELECT 
                    to_char(date_trunc('month', c.created_at), 'YYYY-MM') AS mes,
                    AVG(c.calificacion)::numeric(10,2) AS promedio
                 FROM calificaciones c
                 JOIN materias m ON c.materia_id = m.id
                 WHERE m.profesor_id = $1
                 GROUP BY 1
                 ORDER BY 1`, [profesorId]
            );
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Reporte general de asistencias para profesor
    async getReporteGeneralAsistencias(req, res) {
        try {
            const profesorId = req.usuario.id;
            
            // Obtener todas las materias del profesor
            const materiasResult = await pool.query(
                'SELECT id, nombre FROM materias WHERE profesor_id = $1 ORDER BY nombre',
                [profesorId]
            );
            
            let totalClases = 0;
            let totalPresentes = 0;
            let totalAusentes = 0;
            let totalRetardos = 0;
            
            const porMateria = [];
            
            for (const materia of materiasResult.rows) {
                const asistenciasResult = await pool.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as presentes,
                        SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as ausentes,
                        SUM(CASE WHEN estado = 'retardo' THEN 1 ELSE 0 END) as retardos
                    FROM asistencias a
                    WHERE a.materia_id = $1
                `, [materia.id]);
                
                const stats = asistenciasResult.rows[0];
                totalClases += parseInt(stats.total);
                totalPresentes += parseInt(stats.presentes);
                totalAusentes += parseInt(stats.ausentes);
                totalRetardos += parseInt(stats.retardos);
                
                porMateria.push({
                    materia_nombre: materia.nombre,
                    total: parseInt(stats.total),
                    presentes: parseInt(stats.presentes),
                    ausentes: parseInt(stats.ausentes),
                    retardos: parseInt(stats.retardos)
                });
            }
            
            res.json({
                total_clases: totalClases,
                total_presentes: totalPresentes,
                total_ausentes: totalAusentes,
                total_retardos: totalRetardos,
                por_materia: porMateria
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Reporte específico de asistencias por curso
    async getReporteAsistenciasPorCurso(req, res) {
        try {
            const profesorId = req.usuario.id;
            const { materia_id } = req.params;
            
            // Verificar que la materia pertenezca al profesor
            const materiaResult = await pool.query(
                'SELECT id, nombre FROM materias WHERE id = $1 AND profesor_id = $2',
                [materia_id, profesorId]
            );
            
            if (materiaResult.rows.length === 0) {
                return res.status(403).json({ error: 'No tienes acceso a esta materia' });
            }
            
            // Estadísticas generales
            const totalesResult = await pool.query(`
                SELECT 
                    COUNT(*) as total_clases,
                    SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as total_presentes,
                    SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as total_ausentes,
                    SUM(CASE WHEN estado = 'retardo' THEN 1 ELSE 0 END) as total_retardos
                FROM asistencias a
                WHERE a.materia_id = $1
            `, [materia_id]);
            
            // Historial por fecha
            const porFechaResult = await pool.query(`
                SELECT 
                    a.fecha,
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) as presentes,
                    SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as ausentes,
                    SUM(CASE WHEN estado = 'retardo' THEN 1 ELSE 0 END) as retardos
                FROM asistencias a
                WHERE a.materia_id = $1
                GROUP BY a.fecha
                ORDER BY a.fecha DESC
            `, [materia_id]);
            
            res.json({
                materia: materiaResult.rows[0].nombre,
                totales: totalesResult.rows[0],
                por_fecha: porFechaResult.rows
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Exportar asistencias (CSV)
    async exportarAsistencias(req, res) {
        try {
            const profesorId = req.usuario.id;
            const { materia_id, fecha } = req.query;
            
            let query = `
                SELECT 
                    m.nombre as materia,
                    e.matricula,
                    e.nombre as estudiante,
                    a.fecha,
                    a.estado,
                    a.hora_registro
                FROM asistencias a
                JOIN estudiantes e ON a.estudiante_id = e.id
                JOIN materias m ON a.materia_id = m.id
                WHERE m.profesor_id = $1
            `;
            const params = [profesorId];
            
            if (materia_id) {
                query += ' AND m.id = $' + (params.length + 1);
                params.push(materia_id);
            }
            
            if (fecha) {
                query += ' AND a.fecha = $' + (params.length + 1);
                params.push(fecha);
            }
            
            query += ' ORDER BY m.nombre, a.fecha DESC, e.nombre';
            
            const result = await pool.query(query, params);
            
            // Generar CSV
            let csv = 'Materia,Matrícula,Estudiante,Fecha,Estado,Hora Registro\n';
            result.rows.forEach(row => {
                csv += `"${row.materia}","${row.matricula}","${row.estudiante}","${row.fecha}","${row.estado}","${row.hora_registro}"\n`;
            });
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=asistencias_${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csv);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Exportar asistencias (Excel)
    async exportarAsistenciasExcel(req, res) {
        try {
            const profesorId = req.usuario.id;
            const { materia_id, fecha } = req.query;
            
            // Reutilizar la misma lógica que el CSV
            const query = `
                SELECT 
                    m.nombre as materia,
                    e.matricula,
                    e.nombre as estudiante,
                    a.fecha,
                    a.estado,
                    a.hora_registro
                FROM asistencias a
                JOIN estudiantes e ON a.estudiante_id = e.id
                JOIN materias m ON a.materia_id = m.id
                WHERE m.profesor_id = $1
            `;
            const params = [profesorId];
            
            if (materia_id) {
                query += ' AND m.id = $' + (params.length + 1);
                params.push(materia_id);
            }
            
            if (fecha) {
                query += ' AND a.fecha = $' + (params.length + 1);
                params.push(fecha);
            }
            
            query += ' ORDER BY m.nombre, a.fecha DESC, e.nombre';
            
            const result = await pool.query(query, params);
            
            // Generar HTML simple para Excel
            let html = `
                <table>
                    <tr>
                        <th>Materia</th>
                        <th>Matrícula</th>
                        <th>Estudiante</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Hora Registro</th>
                    </tr>
            `;
            
            result.rows.forEach(row => {
                html += `
                    <tr>
                        <td>${row.materia}</td>
                        <td>${row.matricula}</td>
                        <td>${row.estudiante}</td>
                        <td>${row.fecha}</td>
                        <td>${row.estado}</td>
                        <td>${row.hora_registro}</td>
                    </tr>
                `;
            });
            
            html += '</table>';
            
            res.setHeader('Content-Type', 'application/vnd.ms-excel');
            res.setHeader('Content-Disposition', `attachment; filename=asistencias_${new Date().toISOString().split('T')[0]}.xls`);
            res.send(html);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Exportar asistencias (PDF)
    async exportarAsistenciasPDF(req, res) {
        try {
            const profesorId = req.usuario.id;
            const { materia_id, fecha } = req.query;
            
            // Reutilizar la misma lógica
            const query = `
                SELECT 
                    m.nombre as materia,
                    e.matricula,
                    e.nombre as estudiante,
                    a.fecha,
                    a.estado,
                    a.hora_registro
                FROM asistencias a
                JOIN estudiantes e ON a.estudiante_id = e.id
                JOIN materias m ON a.materia_id = m.id
                WHERE m.profesor_id = $1
            `;
            const params = [profesorId];
            
            if (materia_id) {
                query += ' AND m.id = $' + (params.length + 1);
                params.push(materia_id);
            }
            
            if (fecha) {
                query += ' AND a.fecha = $' + (params.length + 1);
                params.push(fecha);
            }
            
            query += ' ORDER BY m.nombre, a.fecha DESC, e.nombre';
            
            const result = await pool.query(query, params);
            
            // Generar HTML para PDF
            let html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Reporte de Asistencias</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; font-weight: bold; }
                        h1 { color: #333; }
                    </style>
                </head>
                <body>
                    <h1>Reporte de Asistencias</h1>
                    <p>Generado el: ${new Date().toLocaleDateString('es-MX')}</p>
                    <table>
                        <tr>
                            <th>Materia</th>
                            <th>Matrícula</th>
                            <th>Estudiante</th>
                            <th>Fecha</th>
                            <th>Estado</th>
                            <th>Hora Registro</th>
                        </tr>
            `;
            
            result.rows.forEach(row => {
                html += `
                    <tr>
                        <td>${row.materia}</td>
                        <td>${row.matricula}</td>
                        <td>${row.estudiante}</td>
                        <td>${row.fecha}</td>
                        <td>${row.estado}</td>
                        <td>${row.hora_registro}</td>
                    </tr>
                `;
            });
            
            html += `
                    </table>
                </body>
                </html>
            `;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=asistencias_${new Date().toISOString().split('T')[0]}.pdf`);
            res.send(html);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = profesorController;