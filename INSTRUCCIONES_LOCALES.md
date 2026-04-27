# 🚀 Instrucciones para Ejecutar el Sistema Localmente

## ✅ Servidor Local Funcionando
El servidor está corriendo correctamente en:
- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:8000
- **Base de Datos**: PostgreSQL conectada

## 🔧 Solución al Error 502 Bad Gateway

El error 502 que estás viendo ocurre porque estás accediendo a:
```
https://control-escolar-l3g0.onrender.com/
```

Pero el servidor de Render está caído. Necesitas acceder localmente.

## 📋 Pasos para Usar el Sistema Localmente

### 1. **Acceder al Sistema Local**
Abre tu navegador y ve a:
```
http://localhost:8000
```

### 2. **Iniciar Sesión**
Usa las credenciales de desarrollo:
- **Email**: profesor@universidad.edu
- **Contraseña**: profesor123

### 3. **Probar el Escaneo QR**
1. Selecciona el rol **Alumno**
2. Ve al módulo **Asistencia**
3. Selecciona una materia
4. Haz clic en **Activar cámara**
5. Escanea un QR generado por un profesor

## 🎯 Flujo Completo de Prueba

### Como Profesor:
1. Inicia sesión como profesor
2. Ve a **Asistencia** → **Generar QR**
3. Selecciona materia, fecha y hora
4. Genera el QR

### Como Alumno:
1. Inicia sesión como alumno
2. Ve a **Asistencia**
3. Selecciona la misma materia
4. Activa la cámara y escanea el QR

## 📱 Verificación

El escaneo debe:
- ✅ Validar la materia seleccionada
- ✅ Verificar la fecha y hora
- ✅ Registrar la asistencia en tiempo real
- ✅ Mostrarla en el historial

## 🚨 Importante

- **No usar la URL de Render** mientras esté caída
- **Acceder siempre por localhost:8000**
- **El servidor local debe estar corriendo** (npm start en backend)

## 🔍 Si el Problema Persiste

1. Verifica que el servidor esté corriendo:
   ```bash
   cd backend
   npm start
   ```

2. Confirma que veas el mensaje:
   ```
   🚀 Servidor corriendo en http://0.0.0.0:8000
   ```

3. Limpia el caché del navegador:
   - Ctrl+Shift+R (Chrome/Edge)
   - Ctrl+F5 (Firefox)

## 📞 Soporte

El sistema local está funcionando perfectamente. El error 502 es del servidor en la nube, no del código.
