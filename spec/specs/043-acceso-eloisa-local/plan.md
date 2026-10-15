# Plan 043

## Hitos

1. Registrar causa, alcance y consentimiento; pasar compuertas.
2. Corregir mensajes y estilos heredados del tema existente, sin plantilla
   completa de autenticación ni nuevas dependencias.
3. Añadir aplicación local reproducible: daemon/labels/loopback/mutex, copia de
   assets, backup privado y PUT cerrado de campos de presentación.
4. Verificar configuración y cuenta sin recrear el IdP. Recorrido real hasta
   Municipality, error de credenciales, teclado/axe/móvil y assets.
5. Revisión independiente focal, reporte al PO y rollback documentado.

Dependencias: tema existente, contenedor local vivo y credenciales del operador
ya configuradas. No instalar paquetes ni reconstruir aplicaciones.

Riesgos: caché de tema o pérdida de estilos heredados; comprobar recursos y
render real. Drift de configuración: comparar todos los demás campos del realm.
El origen OIDC continúa visible; no se promete una URL nueva.
