const fs = require('fs');
const pool = require('./database/connection.js');

async function ejecutarSQL() {
    try {
        const sql = fs.readFileSync('./crear_tabla_materias_estudiantes.sql', 'utf8');
        console.log('🔧 Ejecutando SQL para crear tabla materias_estudiantes...');
        
        await pool.query(sql);
        console.log('✅ Tabla materias_estudiantes creada exitosamente');
        
        // Verificar que se creó correctamente
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'materias_estudiantes' 
            ORDER BY ordinal_position
        `);
        
        console.log('📋 Estructura de la tabla materias_estudiantes:');
        result.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
        });
        
    } catch (error) {
        console.error('❌ Error al ejecutar SQL:', error);
    } finally {
        await pool.end();
    }
}

ejecutarSQL();
