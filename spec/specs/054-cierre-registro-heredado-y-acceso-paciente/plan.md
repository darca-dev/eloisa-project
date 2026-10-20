# Plan 054

## Fases

1. Congelar el contrato y documentar el cierre del endpoint heredado.
2. Añadir resolución transaccional de paciente aprobado sin alterar los contextos de participación.
3. Reestructurar `patient-self` para que autorización, lectura y auditoría compartan transacción.
4. Actualizar fixtures para que los pacientes autorizados tengan una solicitud aprobada exacta.
5. Cubrir denegaciones por estado, cuenta, vínculo y tenant.
6. Ejecutar pruebas focales y baseline DB pertinente.
7. Auditar el cambio, actualizar la revisión preentrega, hacer commit y publicar la rama.

## Dependencias

- Identidad humana, sesión con vínculo externo exacto y solicitud `AccessRequest` ya existentes.
- Transacciones `withTenant`, rol `merdn_runtime` y políticas RLS vigentes; no se modifica el esquema.
- Runner de baseline y `compose.test.yml` para verificar API/DB en una base aislada de la aplicación local.
- Autorización expresa del Product Owner para commit y push; recibida nuevamente el 2026-10-20 para esta rama.

## Riesgos y verificación

- Una sesión histórica sin vínculo exacto pierde acceso propio: es la denegación prevista y no se migra ni inventa aprobación.
- Lanzar el error dentro de la transacción perdería la auditoría denegada. Se verifica la persistencia del evento y se lanza tras el commit.
- La recuperación/revocación puede competir con una lectura: se conserva el bloqueo compartido de cuenta y se verifica el orden frente a la solicitud.
- El endpoint retirado puede seguir siendo usado por clientes antiguos: devuelve `410` sin procesar ni reflejar sus datos; la web redirige al registro vigente.
- Los gates comprueban estructura y consentimiento, no suficiencia de seguridad ni aceptación del producto. La publicación de la rama no constituye aceptación final.

## Aplicación local y reversión

Reconstruir API y web desde el árbol de trabajo, conservar variables, puertos y controles de los contenedores existentes y comprobar salud, `410` y redirección. No ejecutar migraciones ni modificar PostgreSQL o Keycloak. Conservar las imágenes/configuración anteriores para restituir los contenedores si falla el arranque. No desplegar en producción.
