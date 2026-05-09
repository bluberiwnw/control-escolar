const pool = require('./database/connection.js');

async function verificarEstructuraEstudiantes() {
    try {
        console.log('🔍 Verificando estructura de tabla estudiantes...');
        
        const result = await pool.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'estudiantes' 
            ORDER BY ordinal_position
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ Estructura tabla estudiantes:');
            result.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} (${col.character_maximum_length || 'N/A'} chars, nullable: ${col.is_nullable})`);
            });
        } else {
            console.log('❌ Tabla estudiantes no encontrada');
        }
        
        // Verificar si hay datos que puedan estar causando problemas
        console.log('\n📊 Verificando datos existentes...');
        const estudiantesData = await pool.query(`
            SELECT matricula, nombre, email, 
                   LENGTH(matricula) as matricula_len,
                   LENGTH(nombre) as nombre_len,
                   LENGTH(email) as email_len
            FROM estudiantes 
            ORDER BY LENGTH(matricula) DESC, LENGTH(nombre) DESC 
            LIMIT 5
        `);
        
        console.log('Estudiantes con campos más largos:');
        estudiantesData.rows.forEach(est => {
            console.log(`   - ${est.matricula}: matrícula(${est.matricula_len}), nombre(${est.nombre_len}), email(${est.email_len})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

verificarEstructuraEstudiantes();
