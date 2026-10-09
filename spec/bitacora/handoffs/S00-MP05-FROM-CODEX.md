# S00-MP05 — registro y precarga test verificados

Updated-At: 2026-10-09
Current-Branch: feat/termino-00-mp05-accesos-sin-demo
Required-Base: 389d5fe
Related-Spec: 039-termino-s00-base-y-baseline
Status: VERIFIED-TECHNICAL — interfaz/precarga; procedencia backend pendiente

## Resultado y revisión

Petición corregida del PO aplicada: se conservan tres botones por perfil, rotulados Usuario test, con precarga de todos los campos aplicables y contraseña generada al pulsar. Retirados los avisos generales de datos ficticios del selector, pasos, cierre, ayudas de Isa, hub y revisión Hospital. El mensaje de solicitud/aprobación se conserva. No se retiraron los botones como se había propuesto antes de la aclaración del PO.

Once archivos web en allowlist: wizard, helper/test nuevos, fixtures, ayudas/campos de presentación, hub, bandeja Hospital y tres tests existentes. El helper limita id al perfil, clona fixtures, reinicia campos ausentes, genera 128 bits con Web Crypto y nunca hace peticiones. Contraseña solo en estado React, control Mostrar existente en Confirmación, vaciado finally de cada intento y cambio de perfil conservados. Sin contraseña fija en fixture/código, almacenamiento, logs ni cambios a consentimiento del formulario manual. Fixtures test mantienen su naturaleza: no se crearon personas reales ni cuentas solo por precargar.

POST real existente, estados, validación, bloqueo síncrono, permisos/tenant/RLS y revisión Hospital permanecen. No se modificó API, source, schema, migración, IdP o prototipo. La limitación efectiva de búsqueda de pacientes sigue explícita sin presentarla como demo. Diff técnico cotejado con contrato, semántica y controles de accesibilidad conservados.

## Evidencia

- Gate previo EXIT0, 0 errores/19 advertencias heredadas. Strict previo y de cierre EXIT0/0 advertencias; consent log intacto.
- Pruebas focales: 213/213. Suite web completa: 1901/1901 en 70 archivos, incluyendo 13 casos nuevos de precarga. Los nueve usuarios completan validación de los cinco pasos con credencial válida; repetir genera nueva clave; rechazo de id/perfil ajeno, datos independientes/sin arrastre y fallo seguro de CSPRNG. Pruebas de envío, errores, autorización y vaciado conservadas.
- Tipos web, lint completo, secrets:scan y diff-check correctos. Scanner conserva 53 excepciones/54 ocurrencias; no allowlist ampliada. Docker build web completo correcto, sin dependencias nuevas.
- Imagen activada merdn-web:eloisa-mp05, digest sha256:f4a8cba53bb038692ed30424e4a6a014f1b87a6ae47002b901218a77ffd9688c. Huella de 307 archivos web/shared/config: 7b405031dbb4dc25e58db50e9eb4bb3dd82c11c980c5949f2fd0835493f9f246, árbol base 389d5fe más MP05; documentación posterior no altera esos archivos.
- Solo contenedor web recreado en loopback:3000/red de aplicación existente. API/OIDC/PostgreSQL permanecieron activos con sus imágenes/configuración, sin borrar volúmenes ni datos. Los cuatro healthy. HTTP hub y /acceso?accion=registro: 200; hub con tres entradas y sin rótulos generales demo. Registro se monta en cliente: su HTTP200 por sí solo no verifica interacción.

La habilidad Browser se consultó; no hay navegador conectado (lista vacía). No se verificaron clics/pintado final en navegador, ni envío/provisión/login real. No se enviaron solicitudes a la DB compartida para probar textos. La validación de precarga es unitario-funcional y regresión web; no se anuncia como E2E.

## Pendientes y operación

Hallazgo material: AccessRequestSource solo admite TEST_DATA y API/cliente lo fijan. Corregir los textos NO convierte esa procedencia en real. MP06 propuesto para nuevo origen SELF_REGISTRATION, preservando históricos; decisión PO pendiente antes de migrar. MP04C, baseline completa, decisiones S01 y pruebas IdP siguen pendientes. S00/S01 no aceptados; no se declara producción habilitada. Git local autorizado, sin push/main/merge; rollback por diff inverso/imagen previa, sin borrar registros.
