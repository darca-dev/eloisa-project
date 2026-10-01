Handoff-Version: 73
Updated-At: 2026-09-30
Updated-By: Codex
Current-Branch: feat/038-home-access-two-actions
Current-HEAD: 2e59339
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP04-C3
Status: READY

# Estado vigente - SPEC 038 / MP04-C3

- El Product Owner corrige MP04-C2: requiere cinco pasos por cada perfil, como
  el prototipo, y los iconos originales de Eli.
- MP04-C3 amplia el contrato con un expediente ficticio versionado para que los
  campos adicionales persistan y sean visibles solo al Hospital autorizado.
- La respuesta publica, aprobacion, provisioning, relaciones y asignaciones no
  cambian. La proteccion de reintento MP04-C2-C1 se conserva.
- La migracion se escribe y prueba en base aislada; no se aplica a `merdn_dev`
  antes de auditoria. MP05 y MP06 permanecen cerrados.

---

Handoff-Version: 72
Updated-At: 2026-09-30
Updated-By: Codex
Current-Branch: feat/038-home-access-two-actions
Current-HEAD: 2e59339
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP04-C2-C1
Status: READY

# Estado vigente - SPEC 038 / MP04-C2-C1

- MP04-C2 implementa correctamente la experiencia visual guiada y las tres
  ramas, pero no se acepta aun.
- Hallazgo Codex: despues de un fallo de API, OD-11 borra password y el paso 3
  permite un segundo POST con la credencial vacia.
- MP04-C2-C1 autoriza solo regresar al paso 2, exigir una clave nueva y corregir
  la prueba que actualmente acepta el cuerpo vacio.
- MP05 y MP06 permanecen cerrados.

---

Handoff-Version: 71
Updated-At: 2026-09-30
Updated-By: Codex
Current-Branch: feat/038-home-access-two-actions
Current-HEAD: 2e59339
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP04-C2
Status: READY

# Estado vigente - SPEC 038 / MP04-C2

- El Product Owner aprueba sustituir el formulario tecnico por una inscripcion
  guiada inspirada en el prototipo, con ramas separadas para Paciente, Cuidador
  y Visitador medico.
- MP04-C2 mantiene el POST persistente y la aprobacion Hospital; solo reorganiza
  y mejora la interfaz con selector de perfil, pasos y fixtures filtrados.
- MP04-C1-C1 queda absorbido: el paquete tambien conserva `Registrate` como
  segundo boton debajo de `Iniciar sesion`.
- `/inscripcion`, `prototype-claude/`, backend, DB, OIDC, Hospital y Alcaldia
  permanecen fuera de alcance. MP05 y MP06 siguen cerrados.

---

Handoff-Version: 70
Updated-At: 2026-09-30
Updated-By: Codex
Current-Branch: feat/038-home-access-two-actions
Current-HEAD: 2e59339
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP04-C1-C1
Status: READY

# Estado vigente - SPEC 038 / MP04-C1-C1

- MP04-C1 implementa los destinos y el registro automatico correctamente.
- Auditoria Codex: 47/47 focales y 12/12 E2E contra `:3100`, pero el segundo CTA
  de `/acceso` sigue presentado como enlace de texto.
- MP04-C1-C1 autoriza unicamente convertir `Registrate` en el segundo boton y
  comprobar su posicion bajo `Iniciar sesion` a 320 px.
- MP05 y MP06 permanecen cerrados.

---

Handoff-Version: 69
Updated-At: 2026-09-30
Updated-By: Codex
Current-Branch: feat/038-home-access-two-actions
Current-HEAD: 2e59339
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP04-C1
Status: READY

# Estado vigente - SPEC 038 / MP04-C1

- MP04 fue implementado y publicado en la rama
  `feat/038-demo-funcional-accesos-ficticios`, commit `2e59339`.
- El Product Owner define una correccion de producto: Atencion Domiciliaria debe
  mostrar solo `Iniciar sesion` y `Registrate`; el registro envia
  automaticamente la solicitud pendiente al Hospital.
- MP04-C1 queda listo para implementacion web focal. No cambia backend, DB,
  OIDC, Hospital, Alcaldia ni `/inscripcion`.
- MP05 y MP06 permanecen cerrados.

---

Handoff-Version: 68
Updated-At: 2026-09-30
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP04
Status: READY

# Estado vigente - SPEC 038 / MP04

- El Product Owner acepto expresamente MP03-C2 el 2026-09-30.
- MP04 queda autorizado por handoff v58 como un solo paquete: prepara identidad
  OIDC deshabilitada, provisiona tras aprobacion, protege los tres portales y
  aplica suspension/revocacion sin crear relaciones ni asignaciones.
- La contrasena ficticia solo transita hacia Keycloak local y nunca se persiste
  ni registra en MERDN. El `sub` real si se persiste en el vinculo externo.
- MP05 y MP06 permanecen cerrados.

---

Handoff-Version: 65
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP03-C1-C1
Status: READY

# Estado vigente - SPEC 038 / MP03-C1-C1

- MP03-C1 implementa la API Hospital y sus pruebas focales estan verdes.
- La auditoria detecto busqueda documental con formato incompleta, cursor que
  admite segmentos sobrantes y falta de evento para el 401 sin sesion.
- MP03-C1-C1 agrupa las tres correcciones. El hallazgo reportado sobre el job de
  expiracion no se reproduce en el arbol actual y no se autoriza tocarlo.
- MP03-C2 y provision permanecen cerrados hasta auditoria de la correccion.

---

Handoff-Version: 64
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP03-C1
Status: READY

# Estado vigente - SPEC 038 / MP03-C1

- MP02-C2-C1: PASS. Una sola petición ante doble submit, literales exactos,
  Visitador médico, OpenAPI válido y 7 E2E reales verificados.
- MP03-C1 queda autorizado para API Hospital de listado, búsqueda, detalle y
  decisión persistente. No incluye provisión ni UI. MP03-C2-MP06 siguen cerrados.
- La evidencia PostgreSQL permanece pendiente por la decisión de diferir 025.

---

Handoff-Version: 63
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP02-C2-C1
Status: READY

# Estado vigente - SPEC 038 / MP02-C2-C1

- MP02-C2 implementó el formulario y cliente, con 28 focales y 1.731 pruebas web
  verdes, pero queda en corrección: el estado React no bloquea dos submits del
  mismo tick, status/source no son literales y no hubo prueba de interacción.
- MP02-C2-C1 corrige esos puntos, el rótulo Visitador médico y el ejemplo
  OpenAPI. MP03-MP06 siguen cerrados.

---

Handoff-Version: 61
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP02-C1-C1
Status: READY

# Estado vigente - SPEC 038 / MP02-C1-C1

- MP02-C1 implementó el endpoint y 53 pruebas focales, pero no se acepta: el
  limitador corre antes de validar origen y OpenAPI falla por su lista cerrada.
- MP02-C1-C1 queda autorizado para corregir solo ese orden, prueba y expectativa.
- MP03-MP06 siguen cerrados; evidencia PostgreSQL de MP01 continúa pendiente.

---

Handoff-Version: 60
Updated-At: 2026-09-29
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP02-C1
Status: READY

# Estado vigente - SPEC 038 / MP02-C1

- MP01-C1-C2: PASS estático. Modelo, migración, rollback y formato Prisma son
  coherentes; evidencia PostgreSQL queda pendiente por SPEC 025 diferida.
- MP02-C1 queda autorizado para solicitud pública persistente sin sesión,
  cuenta, Keycloak ni permisos de negocio. MP03-MP06 siguen cerrados.

---

Handoff-Version: 59
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP01-C1-C2
Status: READY

# Estado vigente - SPEC 038 / MP01-C1-C2

- MP01-C1-C1 no se acepta: la restriccion SQL impide una transicion obligatoria
  de aprobacion y el formato Prisma sigue pendiente.
- MP01-C1-C2 queda autorizado solo para corregir esa constraint y formatear el
  schema. No se aplica nada a PostgreSQL y MP02-MP06 permanecen cerrados.
- SPEC 025 sigue diferida.

---

Handoff-Version: 58
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP01-C1-C1
Status: READY

# Estado vigente - SPEC 038 / MP01-C1-C1

- MP01-C1 no se acepta: el schema Prisma valido quedo sin su migracion ni
  rollback por hard stop. No hay cambio aplicado a la base de datos.
- MP01-C1-C1 queda autorizado solo para crear esos dos artefactos y ejecutar
  las validaciones de Prisma. El schema queda congelado durante la correccion.
- SPEC 025 sigue diferida. MP02-MP06 permanecen cerrados.

---

Handoff-Version: 57
Updated-At: 2026-09-28
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 038-demo-funcional-accesos-ficticios
Authorized-Package: MP01-C1
Status: READY

# Estado vigente - SPEC 038 / MP01-C1

- SPEC 025 queda diferida por decisión explícita del Product Owner. Su baseline no
  está aceptada y debe retomarse antes de una entrega de producción.
- SPEC 038 se ejecuta como aplicación funcional local con datos ficticios de prueba
  persistentes; no como una maqueta visual ni con datos reales.
- MP00 mantiene su limitación de evidencia DB diferida. MP01-C1 queda autorizado
  para construir el modelo, migración y controles de datos sin aplicar la migración.
- MP02-MP06 permanecen cerrados.

---

Handoff-Version: 38
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP13
Status: READY

# Estado vigente - dependencia SPEC 025 / MP13

- MP12: PASS no-op. La gobernanza de branding web ya era correcta; Vitest focal
  informa 12 pass.
- Unico paquete autorizado: MP13, runner de baseline y script npm sin ejecucion.
- MP14-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 37
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP12
Status: READY

# Estado vigente - dependencia SPEC 025 / MP12

- MP11: PASS no-op. Las expectativas del cuarto rol ya eran correctas; Vitest
  focal informa 36 pass.
- Unico paquete autorizado: MP12, gobernanza stale de prueba branding web.
- MP13-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 36
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP11
Status: READY

# Estado vigente - dependencia SPEC 025 / MP11

- MP10: PASS. Las 25 pruebas de lifecycle pasan sin infraestructura.
- Unico paquete autorizado: MP11, expectativas stale del cuarto rol en una
  prueba unitaria institucional.
- MP12-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 35
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP10
Status: READY

# Estado vigente - dependencia SPEC 025 / MP10

- MP09-C2: PASS estatico. El cleanup conserva las cinco etapas y no abre
  procesos antes de pasar la validacion de entorno.
- Unico paquete autorizado: MP10, pruebas permanentes puras del lifecycle.
- MP11-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 34
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP09-C2
Status: READY

# Estado vigente - dependencia SPEC 025 / MP09-C2

- MP09-C1: FAIL acotado. Env-file y guard quedan fuera del manejo uniforme de
  CleanupError; un env-file invalido escapa como ProvisionError.
- Unico paquete autorizado: MP09-C2, envoltura sanitizada de env-file y guard.
- MP10-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 33
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP09-C1
Status: READY

# Estado vigente - dependencia SPEC 025 / MP09-C1

- MP09: FAIL acotado. Al envolver un `ProvisionError` pierde su etapa segura y
  reporta `unknown` en vez de identity/down/postcheck.
- Unico paquete autorizado: MP09-C1, preservacion de etapa y prueba pura.
- MP10-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 32
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP09
Status: READY

# Estado vigente - dependencia SPEC 025 / MP09

- MP08-C1: PASS estatico. El preflight usa IDs exclusivos y verifica la
  publicacion externa mediante el contrato MP07 antes del catalogo.
- Unico paquete autorizado: MP09, artefacto de cleanup fail-closed sin ejecutar
  Docker ni PostgreSQL.
- MP10-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 31
Updated-At: 2026-09-27
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP08-C1
Status: READY

# Estado vigente - dependencia SPEC 025 / MP08-C1

- MP08: FAIL acotado. El SQL conductual reutiliza una clave primaria de fixture
  y el catalogo compara un puerto interno/socket con el puerto publicado.
- Unico paquete autorizado: MP08-C1, correccion de identificador efimero,
  verificacion externa de loopback y texto accidental.
- MP09-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 30
Updated-At: 2026-09-26
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP08
Status: READY

# Estado vigente - dependencia SPEC 025 / MP08

- MP07-C1: PASS estatico. La identidad de contenedor, red y volumen se prueba
  antes de cualquier cleanup con volumenes; la integracion Docker queda para la
  primera corrida aislada.
- Unico paquete autorizado: MP08, artefacto de preflight runtime/RLS sin
  ejecutar infraestructura.
- MP09-MP42 de 025 y MP01-MP06 de 038 permanecen cerrados.

---

Handoff-Version: 29
Updated-At: 2026-09-26
Updated-By: Codex
Current-Branch: feat/038-demo-funcional-accesos-ficticios
Current-HEAD: 530a722
Related-Spec: 025-baseline-pruebas-aislada
Authorized-Package: MP07-C1
Status: READY

# Estado vigente — dependencia SPEC 025 / MP07-C1

- MP07: FAIL acotado. El provisionador valida solo contenedores antes de
  `down --volumes`; no inventaría ni valida redes/volúmenes por label y nombre.
- Único paquete autorizado: MP07-C1, comprobación fail-closed de esos recursos.
- MP08–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado vigente — dependencia SPEC 025 / MP07

- MP06: PASS. Runbook auditado; no ejecuta infraestructura.
- Decisión Product Owner de 2026-09-26 registrada: baseline con 14 migraciones
  y owner test `merdn_test_migrator` sin bypass para las 26 tablas.
- Único paquete autorizado: MP07, provisionador aislado sin ejecución.
- MP08–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado anterior — pausa operativa SPEC 025 antes de MP07

---

# Estado vigente — dependencia SPEC 025 / MP06

- MP01-C2 a MP04-C1: PASS en alcance estático; MP04-C1 sigue pendiente de
  ejecución real en PostgreSQL aislado.
- MP05-C1: PASS estático. El catálogo cubre 26 tablas, 27 policies, runtime y
  owners sin SUPERUSER/BYPASSRLS; typecheck API y lint focal pasan.
- Único paquete autorizado: MP06, runbook de remediación FORCE RLS.
- MP07–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado vigente — dependencia SPEC 025 / MP05-C1

- MP01-C2 a MP04-C1: PASS en sus alcances; MP04-C1 permanece pendiente de
  ejecución en PostgreSQL aislado.
- MP05: FAIL acotado. Sus conjuntos y pruebas de runtime son correctos, pero no
  verifica que los owners de las 26 tablas no sean SUPERUSER/BYPASSRLS. El
  reporte afirma erróneamente que las once tablas históricas no tienen FORCE.
- Único paquete autorizado: MP05-C1, aserción de owner no bypass y corrección
  factual del reporte nuevo.
- MP06–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado vigente — dependencia SPEC 025 / MP05

- MP01-C2, MP02-C1 y MP03: PASS.
- MP04-C1: PASS estático. Corrigió los dos fallos SQL, conserva las 15 tablas,
  16 policies, transacción, timeouts y ausencia de DML. La ejecución real sigue
  pendiente del PostgreSQL aislado de MP07/MP15.
- Único paquete autorizado: MP05, aserciones DB-gated de catálogo FORCE RLS.
- MP06–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado vigente — dependencia SPEC 025 / MP04-C1

- MP01-C2, MP02-C1 y MP03: PASS.
- MP04: FAIL. La migración no compila: cinco `SELECT` invierten `FROM`/`WHERE`
  y el preflight usa `r.rolsuper` sin declararlo. El reporte también admite un
  overrun de 40 segundos del hard stop.
- Único paquete autorizado: MP04-C1, corrección mínima de compilación SQL.
- MP05–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado vigente — dependencia SPEC 025 / MP04

- SPEC 025 / MP01-C2: PASS.
- SPEC 025 / MP02-C1: PASS.
- SPEC 025 / MP03: PASS; ocho pruebas puras reproducidas por Codex, sin Docker
  ni base de datos.
- Único paquete autorizado: SPEC 025 / MP04, migración forward FORCE RLS.
- MP05–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado vigente — dependencia SPEC 025 / MP03

- SPEC 025 / MP01-C2: PASS.
- SPEC 025 / MP02-C1: PASS auditado con casos positivos y negativos.
- Único paquete autorizado: SPEC 025 / MP03, pruebas del guard.
- MP04–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado anterior — SPEC 025 / MP02-C1

# Estado vigente — dependencia SPEC 025 / MP02-C1

- SPEC 025 / MP01-C2: PASS.
- SPEC 025 / MP02: FAIL por omisión opcional de topología y falta de vínculo
  entre credenciales/usuarios de variables y URLs.
- Único paquete autorizado: MP02-C1.
- MP03–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado anterior — SPEC 025 / MP02

# Estado vigente — dependencia SPEC 025 / MP02

- SPEC 025 / MP01-C2: PASS auditado por Codex.
- Topología declarativa aislada creada; cero recursos Docker creados.
- Hallazgo no bloqueante: `.env.test.example` existe pero Git lo ignora.
- Único paquete autorizado: SPEC 025 / MP02, guard anti-entorno.
- MP03–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado anterior — SPEC 025 / MP01-C2

# Estado vigente — dependencia SPEC 025 / MP01-C2

- SPEC 038 / MP00-C2: PASS en su alcance correctivo.
- Typecheck API y web: PASS reproducido por Codex.
- SPEC 038 / T00.10: abierta hasta contar con baseline PostgreSQL aislada.
- La instrucción vigente del Product Owner de terminar el proyecto reanuda el
  trabajo necesario para esta dependencia; la pausa histórica de 025 queda
  superada solo dentro de esta secuencia autorizada.
- Único paquete autorizado: SPEC 025 / MP01-C2.
- MP02–MP42 de 025 y MP01–MP06 de 038 permanecen cerrados.

---

# Estado anterior — SPEC 038 / MP00-C2

# Estado vigente — MP00-C2

- MP00-C1 corrigió los hallazgos funcionales y no inició MP01.
- Build completo: PASS.
- Typecheck web: PASS.
- Typecheck API: FAIL con ocho errores en dos archivos de pruebas.
- Docker está disponible; PostgreSQL aún no está levantado.
- Vitest dentro del aislamiento fue bloqueado por `spawn EPERM`; debe repetirse
  fuera del aislamiento.
- MP00-C2 es el único paquete autorizado. MP01 permanece cerrado.
- OpenCode debe ejecutar `TO-CLAUDE.md` v12 y detenerse para auditoría Codex.

---

# Estado anterior — MP00-C1

# Estado operativo canónico

## SPEC 038

- Estado: aprobada por el Product Owner el 2026-09-24.
- Decisiones OD-01 a OD-12: cerradas y aprobadas.
- Consentimiento SDD: registrado personalmente el 2026-09-24 22:34:29 -0600.
- Validación estricta: 0 errores y 0 advertencias.
- Compuerta SDD: abierta; 0 errores y 19 advertencias históricas ajenas al
  alcance de 038.
- Auditoría MP00: `FAIL — CHANGES REQUIRED`.
- Transición OD-01: resuelta con autorización explícita del Product Owner; once
  commits demo aceptados, rama nueva en el mismo HEAD y cambios preservados.
- Paquete autorizado: MP00-C1 exclusivamente.
- MP01: cerrado hasta que MP00-C1 pase auditoría Codex.

## Git y espacio de trabajo

- Rama actual: `feat/038-demo-funcional-accesos-ficticios`.
- HEAD observado: `530a722`.
- Merge-base con `develop`: `ad7a18c`; once commits demo aceptados por el Product
  Owner; HEAD preservado `530a722`.
- Existen cambios documentales sin commit de la spec 038 y su registro de
  aprobación/consentimiento.
- No están autorizados commit, merge, rebase, cherry-pick, push, PR, release ni
  despliegue.
- No se autorizan más acciones Git durante MP00-C1.

## Código y pruebas

- Codex no modificó código de producción.
- El build observado durante la redacción pasó.
- La suite web observada tenía 1.693/1.700 pruebas exitosas y siete fallos en
  seis archivos; MP00 debe clasificarlos y recuperar una línea base verde.
- `/acceso` usa `DemoNavigation`; `CentralAccess` existe pero no está conectado.
- Hospital y Alcaldía inyectan contexto ficticio en rutas que deben separarse
  del modo demo controlado por servidor.

## Siguiente acción

Claude Code/OpenCode ejecuta `TO-CLAUDE.md` para MP00-C1, actualiza
`FROM-CLAUDE.md` con evidencia fiel y se detiene para auditoría Codex.
