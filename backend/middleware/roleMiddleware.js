const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        console.log('🔍 Verificando rol:', {
            usuario: req.usuario,
            rolUsuario: req.usuario?.rol,
            tipoUsuario: req.usuario?.tipo,
            rolesPermitidos,
            incluyeRol: rolesPermitidos.includes(req.usuario?.rol),
            headers: req.headers
        });
        
        if (!req.usuario) {
            console.log('❌ req.usuario es undefined o null');
            return res.status(403).json({ message: 'Acceso denegado. Usuario no autenticado.' });
        }
        
        if (!req.usuario.rol) {
            console.log('❌ req.usuario.rol es undefined o null');
            return res.status(403).json({ message: 'Acceso denegado. Rol no definido.' });
        }
        
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            console.log('❌ Rol no permitido:', {
                rolActual: req.usuario.rol,
                rolesPermitidos,
                tipoActual: req.usuario.tipo
            });
            return res.status(403).json({ 
                message: 'Acceso denegado. No tienes permisos suficientes.',
                debug: {
                    rolActual: req.usuario.rol,
                    tipoActual: req.usuario.tipo,
                    rolesPermitidos
                }
            });
        }
        
        console.log('✅ Verificación de rol exitosa');
        next();
    };
};

module.exports = { verificarRol };