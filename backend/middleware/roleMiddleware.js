const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        console.log(' Verificando rol:', {
            usuario: req.usuario,
            rolUsuario: req.usuario?.rol,
            rolesPermitidos,
            incluyeRol: rolesPermitidos.includes(req.usuario?.rol)
        });
        
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ message: 'Acceso denegado. No tienes permisos suficientes.' });
        }
        next();
    };
};

module.exports = { verificarRol };