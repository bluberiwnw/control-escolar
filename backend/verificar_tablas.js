const pool = require('./database/connection.js');

async function verificarTablas() {
    try {
        console.log('🔍 Verificando tablas necesarias...');
        
        // Tablas a verificar
        const tablas = [
            'estudiantes',
            'materias', 
            'materias_estudiantes',
            'calificaciones',
            'usuarios'
        ];
        
        for (const tabla of tablas) {
            try {
                const result = await pool.query(`
                    SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = $1 
                    ORDER BY ordinal_position
                `, [tabla]);
                
                if (result.rows.length > 0) {
                    console.log(`✅ Tabla '${tabla}' - Columnas:`);
                    result.rows.forEach(col => {
                        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
                    });
                } else {
                    console.log(`❌ Tabla '${tabla}' - NO EXISTE`);
                }
            } catch (error) {
                console.log(`❌ Error verificando tabla '${tabla}':`, error.message);
            }
        }
        
        // Verificar conexión básica
        const testResult = await pool.query('SELECT NOW()');
        console.log('✅ Conexión a base de datos OK:', testResult.rows[0].now);
        
    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        await pool.end();
    }
}

verificarTablas();
