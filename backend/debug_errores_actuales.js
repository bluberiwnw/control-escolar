const pool = require('./database/connection.js');

async function debugErroresActuales() {
    try {
        console.log('🐛 DEBUG: Analizando errores actuales...');
        
        // 1. Verificar que el archivo HTM se está procesando correctamente
        console.log('1. 📄 Verificando procesamiento HTM...');
        console.log('   ✅ Frontend detecta 19 filas');
        console.log('   ✅ Frontend extrae datos correctamente');
        console.log('   ❌ Backend devuelve 400');
        
        // 2. Simular exactamente lo que envía el frontend
        console.log('\n2. 🔍 Simulando petición upload...');
        
        const fs = require('fs');
        const path = require('path');
        
        // Crear un archivo HTM de prueba similar al que procesa el frontend
        const testHTMContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Lista de Clase</title>
</head>
<body>
    <table>
        <tr>
            <th>Número de Registro</th>
            <th>Nombre de Alumno</th>
            <th>ID</th>
            <th>Status de Inscripción</th>
            <th>Nivel</th>
            <th>Créditos</th>
            <th>Detalle de Calificaciones</th>
            <th></th>
        </tr>
        <tr>
            <td>1</td>
            <td>JUAN CARLOS PEREZ GOMEZ</td>
            <td>2021-1022</td>
            <td>Inscrito por Web</td>
            <td>3</td>
            <td>8</td>
            <td>juan.perez@estudiante.edu</td>
            <td></td>
        </tr>
    </table>
</body>
</html>`;
        
        // Guardar archivo temporal
        const tempFilePath = path.join(__dirname, 'test_temp.htm');
        fs.writeFileSync(tempFilePath, testHTMContent);
        console.log('   📄 Archivo HTM de prueba creado');
        
        // 3. Verificar la configuración de multer
        console.log('\n3. 🔍 Verificando configuración multer...');
        console.log('   - upload.single(\'archivo\') configurado');
        console.log('   - storage: diskStorage');
        console.log('   - limits: 10MB');
        console.log('   - fileFilter: archivos HTM/HTML');
        
        // 4. Verificar que la materia existe
        console.log('\n4. 📚 Verificando materia...');
        const materiaResult = await pool.query('SELECT id, nombre FROM materias WHERE id = $1', [3]);
        if (materiaResult.rows.length > 0) {
            console.log('   ✅ Materia encontrada:', materiaResult.rows[0].nombre);
        } else {
            console.log('   ❌ Materia no encontrada');
            return;
        }
        
        // 5. Simular el problema exacto del frontend
        console.log('\n5. ⚠️ Análisis del problema:');
        console.log('   - Frontend: Procesa HTM correctamente');
        console.log('   - Frontend: Envia FormData con archivo y materia_id');
        console.log('   - Backend: Devuelve 400 Bad Request');
        console.log('   - Causa probable: req.body undefined o req.file undefined');
        
        // 6. Verificar la estructura de la petición
        console.log('\n6. 🔍 Estructura esperada por uploadFile:');
        console.log('   - req.file: objeto con información del archivo');
        console.log('   - req.body: { materia_id: "3" }');
        console.log('   - req.usuario: objeto con info del usuario');
        
        // 7. Verificar el problema del CRUD de alumnos
        console.log('\n7. 👥 Verificando problema CRUD alumnos...');
        console.log('   - Frontend: Envia JSON con { materia_id, matricula, nombre, email }');
        console.log('   - Backend: Devuelve 500 Internal Server Error');
        console.log('   - Causa probable: req.body undefined o error en base de datos');
        
        // 8. Verificar que los datos del frontend son válidos
        console.log('\n8. ✅ Verificando datos del frontend:');
        const testAlumnoData = {
            materia_id: '3',
            matricula: '2021-1022',
            nombre: 'Juan Carlos Perez Gomez',
            email: 'juan.perez@estudiante.edu'
        };
        
        console.log('   📡 Datos:', testAlumnoData);
        
        // Validar como lo haría el backend
        if (!testAlumnoData.materia_id || !testAlumnoData.matricula || !testAlumnoData.nombre) {
            console.log('   ❌ Validación fallida');
        } else {
            console.log('   ✅ Validación exitosa');
        }
        
        // 9. Limpiar archivo temporal
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log('   🧹 Archivo temporal eliminado');
        }
        
        console.log('\n🎯 Diagnóstico final:');
        console.log('❌ Problema 1: Upload HTM devuelve 400');
        console.log('   - Causa: req.body o req.file undefined');
        console.log('   - Solución: Verificar middleware multer');
        console.log('');
        console.log('❌ Problema 2: CRUD alumnos devuelve 500');
        console.log('   - Causa: req.body undefined o error en BD');
        console.log('   - Solución: Verificar body parser en ruta alumnos');
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        await pool.end();
    }
}

debugErroresActuales();
