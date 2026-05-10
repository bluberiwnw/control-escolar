const pool = require('./database/connection.js');

async function crearTablaPonderaciones() {
    try {
        console.log('🔧 Creando tabla ponderaciones si no existe...');
        
        // Verificar si la tabla existe
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ponderaciones'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('📋 Creando tabla ponderaciones...');
            
            // Crear la tabla
            await pool.query(`
                CREATE TABLE ponderaciones (
                    id SERIAL PRIMARY KEY,
                    materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
                    tipo VARCHAR(50) NOT NULL,
                    peso DECIMAL(5,2) NOT NULL CHECK (peso >= 0 AND peso <= 100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(materia_id, tipo)
                );
            `);
            
            console.log('✅ Tabla ponderaciones creada exitosamente');
            
            // Insertar ponderaciones por defecto para las materias existentes
            const materiasQuery = await pool.query('SELECT id FROM materias');
            
            for (const materia of materiasQuery.rows) {
                const defaultPonderaciones = [
                    { tipo: 'tarea', peso: 20 },
                    { tipo: 'examen', peso: 30 },
                    { tipo: 'participacion', peso: 10 },
                    { tipo: 'proyecto', peso: 25 },
                    { tipo: 'practica', peso: 15 }
                ];
                
                for (const ponderacion of defaultPonderaciones) {
                    await pool.query(`
                        INSERT INTO ponderaciones (materia_id, tipo, peso) 
                        VALUES ($1, $2, $3)
                    `, [materia.id, ponderacion.tipo, ponderacion.peso]);
                }
            }
            
            console.log('✅ Ponderaciones por defecto insertadas');
            
        } else {
            console.log('✅ Tabla ponderaciones ya existe');
            
            // Verificar si tiene datos
            const countQuery = await pool.query('SELECT COUNT(*) as count FROM ponderaciones');
            console.log(`📊 Ponderaciones existentes: ${countQuery.rows[0].count}`);
        }
        
        console.log('🎯 Proceso completado exitosamente');
        
    } catch (error) {
        console.error('❌ Error al crear tabla ponderaciones:', error.message);
    } finally {
        await pool.end();
    }
}

crearTablaPonderaciones();
