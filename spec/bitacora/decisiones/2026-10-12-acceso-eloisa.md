# Acceso Eloisa en español

PO rechaza la pantalla técnica de login: «de nada me sirve esa pantalla».
Contexto explícito: registro y prueba del primer administrador Municipality.
Las instrucciones vigentes de completar módulos reales y el rechazo de esta
experiencia autorizan corregir y aplicar localmente su presentación.

043 activa el tema Eloisa existente, corrige el campo Usuario y mantiene el
flujo OIDC compartido. No se crea otra autenticación, no se cambian permisos ni
contraseñas, no se recrea/reimporta Keycloak y no se borra la cuenta de prueba.
Se verifica la vuelta a Municipality con la misma cuenta. Rama local separada
fix/acceso-eloisa-local, sin integrar main/develop ni publicar esta corrección.

La dirección del proveedor sigue siendo el origen OIDC canónico aprobado;
ocultar/cambiar ese origen mediante proxy es otra decisión y queda fuera.
