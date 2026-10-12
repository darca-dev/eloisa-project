# Historia 040

## 2026-10-12 — hallazgos de integración real

El token administrativo requería Content-Type form-urlencoded; corregido y probado.
Keycloak 26.7.1 ignora atributos no gestionados y rechaza el literal DISABLED
en user-profile: se omite la política (valor deshabilitado por defecto) y se
declara el marcador solo para administración. Su PUT real devuelve 200.
El navegador descartó las cookies Secure en host.docker.internal HTTP: se
adopta merdn.localhost exacto con resolución Docker explícita, sin relajar cookies,
validación criptográfica ni restricciones de entorno. E2E posterior pasó en ambas
experiencias; repetición de scripts promovidos y baseline global pendientes.

## 2026-10-12 — verificación y operación local

Alta/recuperación/login real/API/logout y exclusividad correctos en Chromium,
Keycloak y PostgreSQL aislados. API/web activos renovados con backup restaurado
y conteos comprobados; se conservan 41 cuentas y cuatro vínculos verificados,
conciliados con auditoría sin cambiar contraseñas. Cupos activos siguen libres.
OpenAPI 56, web 1909, integración institucional 20 y scripts identidad 9 correctos.
Formularios activos axe sin violaciones, teclado y 320 px correctos. Informe en
docs/REVISION-MODULOS-REALES.md. Revisión independiente sin nuevos bloqueos;
corregidas dos observaciones menores de catálogo y publicaciones loopback.
No se declara S01 completo ni se inventa aceptación PO.

## 2026-10-12 — autorización de implementación

PO autoriza explícitamente todos los módulos reales y pide detalle por módulo.
Revisión independiente acota Person obligatorio, protección contra apropiación de
documentos, saga con intento probado por cookie, capacidades internas sin secretos,
actor nominal y cierre legacy. Gates SDD pasan con 0 errores antes de producción.

## 2026-10-12

La Product Owner establece un único registro inicial por institución: quien se
registra primero es administrador; no hay acceso administrativo para otros ni
gestión de roles por ahora. Se registra decisión y propuesta técnica 040.

Solo se modifican documentos de especificación y decisión. No se crea ninguna
cuenta ni se modifica código, proveedor de identidad, base activa o Docker.
No se hereda consentimiento de 039/038. El 12 de octubre se registró la nueva instrucción expresa de implementación del PO.

### Correcciones de revisión independiente 2026-10-12

### Entrega local verificada 2026-10-12

Se completó posteriormente la implementación autorizada: formularios, reservas,
OIDC real, guards y auditoría. E2E aislada Hospital/Municipalidad correcta en dos
ejecuciones; baseline de 30 etapas y 2596 pruebas, cero fallos y cero omisiones.
20 migraciones aplicadas tras restaurar backup de comprobación. Se preservaron
41 cuentas y cuatro vínculos; cupos activos de ambos primeros administradores
libres. Tipos/build/lint/scanner y accesibilidad focal correctos. Detalle actual
en docs/REVISION-MODULOS-REALES.md. Aceptación PO e integración Git separadas.

Cada sesión nueva conserva el vínculo externo exacto que autenticó al usuario; las capacidades institucionales exigen ese mismo vínculo. Las sesiones históricas sin atribución de vínculo no conceden administración. Una declaración pública no reutiliza cuentas administradoras, incluso durante la reserva. El claim de cuenta existente rechaza cuentas con solicitudes personales previas; bloqueo de persona serializa claim y submission. El navegador propietario puede recuperar el resultado confirmado tras perder la respuesta, sin reabrir el cupo.
