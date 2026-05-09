const calificacionController = require('./controllers/calificacionController.js');
const fs = require('fs');
const path = require('path');

// Verificar que las funciones existan
const funciones = ['getPlantilla', 'uploadFile', 'createAlumno', 'updateAlumno', 'deleteAlumno', 'getAlumnosByMateria', 'processHtmlFile', 'calcularFinal'];

console.log('🔍 Verificando funciones del calificacionController.js...');

funciones.forEach(func => {
  if (typeof calificacionController[func] === 'function') {
    console.log('✅', func, '- Función encontrada');
  } else {
    console.log('❌', func, '- Función NO encontrada');
  }
});

// Verificar archivo de plantilla
const plantillaPath = path.join(__dirname, 'templates/plantilla_buap_completa.htm');
if (fs.existsSync(plantillaPath)) {
  console.log('✅ Plantilla BUAP existe:', plantillaPath);
} else {
  console.log('❌ Plantilla BUAP NO existe:', plantillaPath);
}

console.log('🎯 Verificación completada');
