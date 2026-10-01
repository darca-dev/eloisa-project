# Tareas 038 — Demo funcional de registros y aprobaciones ficticias

## Estado

Checklist aprobado y consentido. Solo está autorizado el paquete que indique el
handoff canónico vigente; completar un paquete no abre automáticamente el
siguiente.

## MP00 — Reconciliación y línea base

- [x] T00.1 Cerrar OD-01 a OD-12 con decisiones de Product Owner.
- [x] T00.2 Registrar la rama base sin merge, rebase ni commit. Basada en
  `feat/038-demo-funcional-accesos-ficticios`, HEAD `530a722`, base contra
  `develop` en `ad7a18c` (11 commits); sin acciones Git en esta ejecución.
- [x] T00.3 Reconciliar 027 e índice sin aprobar retroactivamente código.
- [x] T00.4 Registrar cómo 038 sustituye el modo en memoria de 035.
- [x] T00.5 Clasificar los siete fallos web actuales.
- [x] T00.6 Corregir regresiones o expectativas con trazabilidad.
- [x] T00.7 Conectar `/acceso` a una composición autorizada.
- [x] T00.8 Separar rutas protegidas del modo demo de servidor.
- [x] T00.9 Auditar provisión de 027: password, `sub`, transacción, logs y retry.
  Registrada como auditoría aplicable con disposición de cuarentena documental
  en `research.md` §Disposición de cuarentena: prohibido password, `sub`
  pregenerado, commit antes del IdP, logs con username y retry defectuoso; la
  provisión nueva se implementa en MP04. Sin rediseño de identidad en MP00-C1.
- [ ] T00.10 Ejecutar build, typecheck, web y SDD; entregar base verde.

## MP01 — Datos, RLS y auditoría

- [ ] T01.1 Añadir catálogos de perfil, estado, provisión y motivos.
- [ ] T01.2 Añadir capacidad `HOSPITAL_ACCESS_REVIEWER` disjunta.
- [ ] T01.3 Añadir `AccessRequest` con tenant, referencia y versión.
- [ ] T01.4 Añadir unicidad y FKs compuestas.
- [ ] T01.5 Añadir RLS y grants mínimos sin DELETE ordinario.
- [ ] T01.6 Añadir eventos/métodos de auditoría sin PII.
- [ ] T01.7 Crear migración aditiva y rollback condicional.
- [ ] T01.8 Probar dos tenants, unicidad, FKs, RLS, grants y rollback.

## MP02 — Registro persistente

- [ ] T02.1 Definir DTOs cerrados para crear solicitud.
- [ ] T02.2 Implementar validación, errores neutrales, rate limit e idempotencia.
- [ ] T02.3 Implementar creación/reconciliación transaccional local.
- [ ] T02.4 Preparar identidad deshabilitada según OD-03/OD-11.
- [ ] T02.5 Separar sesión, solicitud y exploración en `/acceso`.
- [ ] T02.6 Integrar los tres perfiles sin otorgar permisos.
- [ ] T02.7 Señalizar persistencia, estado pendiente y datos ficticios.
- [ ] T02.8 Probar recarga, reinicio, duplicado, DB/OIDC y accesibilidad.

## MP03 — Revisión Hospital

- [ ] T03.1 Implementar guard exacto del revisor.
- [ ] T03.2 Implementar listado paginado/minimizado por tenant.
- [ ] T03.3 Implementar decisión con versión e idempotencia.
- [ ] T03.4 Auditar listado, decisión y denegaciones.
- [ ] T03.5 Conectar bandeja a API y retirar estado React como verdad.
- [ ] T03.6 Implementar carga, vacío, error, conflicto y confirmaciones.
- [ ] T03.7 Probar rol, cross-tenant, Alcaldía, solicitante y concurrencia.

## MP04 — Provisión y acceso posterior

- [ ] T04.1 Implementar saga/estado de provisión e idempotencia Keycloak.
- [ ] T04.2 Persistir y verificar el `sub` real.
- [ ] T04.3 Implementar Paciente aprobado self-scope.
- [ ] T04.4 Implementar portada Cuidador sin datos cuando no hay relación.
- [ ] T04.5 Implementar perfil/afiliación profesional según OD-06.
- [ ] T04.6 Mantener asignaciones como autorización separada.
- [ ] T04.7 Implementar suspensión/revocación y OD-04.
- [ ] T04.8 Probar login antes/después, fallo OIDC, relación y asignación.

## MP04-C1 — Entrada domiciliaria con dos acciones

- [ ] T04.C1.1 Dejar en la tarjeta domiciliaria solo `Iniciar sesión` y `Regístrate`.
- [ ] T04.C1.2 Dejar en `/acceso` sin sesión las mismas dos acciones.
- [ ] T04.C1.3 Hacer que `Regístrate` abra el formulario persistente y que su
  envío cree automáticamente la solicitud Hospital existente.
- [ ] T04.C1.4 Retirar de estas superficies los CTA `Solicitar acceso` y
  `Registro guiado`, sin eliminar la ruta histórica `/inscripcion`.
- [ ] T04.C1.5 Verificar teclado, 320 px, una sola petición y confirmación
  `PENDING` previa a aprobación.

## MP05 — Seed, reset y operación

- [ ] T05.1 Aprobar dataset ficticio exacto.
- [ ] T05.2 Crear carga determinista de dos tenants ficticios.
- [ ] T05.3 Crear reset con allowlist de ambiente/base/realm/tenant.
- [ ] T05.4 Añadir scripts npm sin dependencias nuevas.
- [ ] T05.5 Crear `docs/runbooks/demo.md` con arranque y healthchecks.
- [ ] T05.6 Mantener credenciales solo en variables locales ignoradas.
- [ ] T05.7 Probar dos resets, denegación segura y recuperación.

## MP06 — Verificación y handoff

- [ ] T06.1 E2E Paciente independiente.
- [ ] T06.2 E2E Cuidador sin y con relación autorizada.
- [ ] T06.3 E2E Personal de terreno sin y con asignación autorizada.
- [ ] T06.4 E2E Hospital, cross-tenant, conflicto, fallo OIDC y revocación.
- [ ] T06.5 Ejecutar axe, teclado y responsive a 320 px.
- [ ] T06.6 Ejecutar build, typecheck, lint, Prisma, secretos y suites.
- [ ] T06.7 Ejecutar compuerta y validación SDD estricta.
- [ ] T06.8 Ensayar guion y recuperación desde runbook.
- [ ] T06.9 Entregar evidencia para auditoría Codex.
- [ ] T06.10 Codex audita; Product Owner acepta o rechaza.

## MP04-C2 - Inscripcion guiada por perfil

- [ ] T04.C2.1 Presentar selector accesible de Paciente, Cuidador y Visitador medico.
- [ ] T04.C2.2 Crear pasos de datos personales, contacto/credencial y revision.
- [ ] T04.C2.3 Mostrar solo los tres fixtures demo del perfil seleccionado.
- [ ] T04.C2.4 Reiniciar la rama al cambiar perfil y conservarla al retroceder.
- [ ] T04.C2.5 Enviar un unico access request sin ampliar el cuerpo ni persistir password.
- [ ] T04.C2.6 Mostrar referencia, `PENDING` y espera de aprobacion Hospital.
- [ ] T04.C2.7 Verificar las tres ramas, validacion, teclado, foco, axe y 320 px.

## MP04-C3 - Cinco pasos e iconos de Eli

- [ ] T04.C3.1 Agregar instantanea versionada de registro a AccessRequest.
- [ ] T04.C3.2 Validar cuerpos cerrados y discriminados de los tres perfiles.
- [ ] T04.C3.3 Persistir atomica y tenant-scoped sin password ni PII en logs.
- [ ] T04.C3.4 Exponerla solo en detalle Hospital autorizado y auditado.
- [ ] T04.C3.5 Implementar cinco pasos exactos para Paciente.
- [ ] T04.C3.6 Implementar cinco pasos exactos para Cuidador.
- [ ] T04.C3.7 Implementar cinco pasos exactos para Visitador medico.
- [ ] T04.C3.8 Restaurar `guia`, `escucha`, `agradece` y `saluda2` en su lugar.
- [ ] T04.C3.9 Enriquecer los nueve fixtures ficticios sin credenciales embebidas.
- [ ] T04.C3.10 Verificar API, DB aislada, Hospital, E2E, axe, 320 px y regresion.

## MP04-C3-C1 - Cierre de auditoria, DB y cinco secciones Hospital

- [ ] T04.C3.C1.1 Auditar atomicamente el conflicto 409 sin PII.
- [ ] T04.C3.C1.2 Probar snapshot, dos tenants, RLS y rollback en PostgreSQL aislado sin skips.
- [ ] T04.C3.C1.3 Presentar Datos personales y las otras cuatro secciones en el detalle Hospital.
- [ ] T04.C3.C1.4 Verificar focales, tipos, lint, builds, Prisma y compuertas SDD.

## MP04-C4 - Fidelidad visual de la inscripción Eloisa

- [ ] T04.C4.1 Separar encabezado, tarjeta de progreso y tarjeta del contenido.
- [ ] T04.C4.2 Homologar tipografía, medidas, colores, radios y estados de los cinco pasos.
- [ ] T04.C4.3 Homologar guía de Elí, secciones, filas de campos y controles responsivos.
- [ ] T04.C4.4 Integrar los tres fixtures de cada rama sin alterar datos ni envío.
- [ ] T04.C4.5 Verificar comparación visual, teclado, foco, axe, 320 px y regresión funcional.

## Prohibiciones operativas

- [ ] No ejecutar `confirm-user-consent.sh` por iniciativa del agente.
- [ ] No modificar `prototype-claude/`, `tasks/`, `reviews/` ni `main`.
- [ ] No hacer commit, merge, push, PR, release o deploy sin autorización.
- [ ] No usar datos o credenciales reales.
- [ ] No declarar el demo como producción ni verificación oficial.
