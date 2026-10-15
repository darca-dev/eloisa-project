# Investigación 043

Keycloak activo conserva contenedor y usuarios; solo monta el antiguo archivo
de importación. El tema Eloisa versionado no está montado/copiado y el realm
todavía usa presentación genérica. Reimportar/recrear perdería estado local.

Alternativa elegida: copiar tema al mismo contenedor y actualizar únicamente
presentación/locales mediante API administrativa local. Extender keycloak.v2
conserva sus formularios de login y cambio obligatorio de contraseña.
Personalización documentada: https://www.keycloak.org/ui-customization/themes.

El tema existente sustituye css/login.css de su padre: renombrar personalización
y cargar primero estilos base. La etiqueta Correo es incorrecta para los usuarios
opacos que devuelve el registro: debe decir Usuario. Usar marca general para
Hospital/Municipality y atención domiciliaria compartidos.

No implementar un segundo login propio ni manipular tokens desde UI. No cambiar
issuer ni permisos. No crear otras cuentas para comprobarlo.
