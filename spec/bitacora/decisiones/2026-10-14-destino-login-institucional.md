# Corregir destino institucional del login — 2026-10-14

PO: «el login de ese esta afectando todos los login si entro a hospital ya entro directo».
Aclara el resultado: «Me devuelve al panel de Alcaldía».

Se corrige el destino perdido por047 conservando un único proveedor/identidad y los permisos actuales. El intento almacenará una de dos rutas protegidas institucionales exactas y pedirá formulario interactivo. La selección de Hospital no concede su administración a una cuenta municipal. API/SQL siguen rechazando destinos ajenos y login personal mantiene /acceso.

La corrección y aplicación local están dentro del trabajo de acceso real ya autorizado; no se crean cuentas, no se modifican paneles ni se publica Git. Se respalda PostgreSQL antes de ampliar el CHECK; imágenes previas permiten rollback de aplicación conservando la migración aditiva y fallo cerrado de intentos nuevos.
