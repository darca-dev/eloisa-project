# Specification Index / Índice de especificaciones

Las specs **001–017 son as-built**: describen capacidad ya implementada antes de
la adopción de SDD el 2026-08-25. Aprobar una de ellas significa confirmar que
describe fielmente lo construido, no autorizar trabajo nuevo. Ver
`TRAZABILIDAD.md` para el detalle y `board.canvas` para las dependencias.

La spec **018 es la primera prospectiva**: define trabajo **no ejecutado** —dos
correcciones de la auditoría de Visitador MP02— y aprobarla sí autoriza
implementar, dentro de su allowlist de dos archivos y previo consentimiento.

Estado de aprobación `Pendiente` en las specs 001–017. La **018 está aprobada**
desde el 2026-08-25, con alcance limitado a dos correcciones, y la **021 desde el
2026-08-26**; aun así la compuerta no abre para ninguna de las dos hasta que el
Product Owner registre el consentimiento por spec.

La spec **021 es la segunda prospectiva de esta rama**, y la primera que no nace
de una auditoría sino de una decisión de producto: el **MVP operativo del
Paciente** para el hito del 2 de septiembre. Define acceso autenticado,
recuperación de sesión, logout revocable, resumen propio, citas propias, visitas
propias, los seis estados de interfaz, self-scope, tenant/RLS y auditoría.

**Actualizada el 2026-08-26. No le queda ninguna decisión de producto abierta.**
Se cerraron las **nueve** de §17.B —sesión humana **OIDC** canónica; **sin
autorregistro** de identidad, con aprovisionamiento administrativo existente; se
conserva **`/`** y no se crea `/paciente`, evitando migrar los return targets;
**auditoría obligatoria**, con migración aditiva mínima admitida y explícita;
resumen mínimo; citas y visitas **solo propias**, sin IDs técnicos ni terceros;
controles demo **ocultos** pero con su código conservado; ninguna dependencia
nueva; y una **definición de terminación de dieciséis elementos** (§20)— y las
**dos** de §17.C: la **entrada post-inscripción** —la cookie de inscripción solo
confirma, `/` muestra «Inscripción completada» y hay una entrada separada
«Ingresar como Paciente» que exige sesión OIDC— y el **resumen cerrado en tres
campos**: nombre de pila, iniciales y la etiqueta fija `Paciente`.

**Tampoco le queda ningún asunto de arquitectura abierto.** Codex los resolvió
el mismo 2026-08-26 y emitió `PASS WITH CORRECTIONS` (§17.D): auditoría con
**dos** valores nuevos de enum —`PATIENT_SELF_ACCESS_GRANTED` y
`PATIENT_SELF_ACCESS_DENIED`— diferenciados por `resourceType` y `endpoint` en el
`AuditService` existente, con migración aditiva mínima y rollback **condicional**
que se rechaza si hay eventos dependientes; **tres endpoints exactos** —
`GET /api/v1/patient-self/summary`, `/appointments` y `/visits`—, sin selector de
sujeto; y el cliente de sesión humana **`MOVE TO SHARED`** a
`features/auth/humanSessionClient.ts`, con fachada compatible en Hospital. La
ejecución queda descompuesta en **cinco micro-paquetes** de quince minutos.

**Aprobada el 2026-08-26** por el Product Owner, con las once decisiones de
producto cerradas y los tres asuntos de arquitectura resueltos. Sigue **sin
consentimiento**: la compuerta **no abre** hasta que el Product Owner ejecute
personalmente `confirm-user-consent.sh`. **Cero líneas de código escritas.**

**Hueco de numeración 019–020.** No es un error. Esos dos identificadores existen
en la rama `feat/visitador-mp02-corrections`
—`019-validacion-interactiva-visitador-mp02` y
`020-aviso-logout-fallido-visitador`— y todavía no están en `develop`. La spec de
Paciente tomó **021** para que las tres convivan cuando Visitador se integre.

| Number / Número | Name / Nombre | Status / Estado | Priority / Prioridad | Owner / Responsable | Updated / Actualización |
|---|---|---|---|---|---|
| 001 | fundacion-tecnica-monorepo | Done / Completada | High / Alta | Product Owner | 2026-08-25 |
| 002 | experiencia-inscripcion-visual | UI only / Solo interfaz | Medium / Media | Product Owner | 2026-08-25 |
| 003 | experiencia-visual-hospital | Partial / Parcial | High / Alta | Product Owner | 2026-08-25 |
| 004 | orquestador-merdn | Done / Completada | Low / Baja | Product Owner | 2026-08-25 |
| 005 | experiencia-visual-alcaldia | UI only / Solo interfaz | High / Alta | Product Owner | 2026-08-25 |
| 006 | marca-eloisa-isa | Done / Completada | Low / Baja | Product Owner | 2026-08-25 |
| 007 | inscripcion-paciente-persistente | Done / Completada | High / Alta | Product Owner | 2026-08-25 |
| 008 | agregados-municipales-protegidos | Partial / Parcial | High / Alta | Product Owner | 2026-08-25 |
| 009 | hospital-pacientes-api | Done / Completada | High / Alta | Product Owner | 2026-08-25 |
| 010 | hospital-profesionales-agenda-api | Done / Completada | High / Alta | Product Owner | 2026-08-25 |
| 011 | identidad-humana-y-relaciones | Partial / Parcial | High / Alta | Product Owner | 2026-08-25 |
| 012 | visitas-domiciliarias | Partial / Parcial | High / Alta | Product Owner | 2026-08-25 |
| 013 | visitas-visibles-en-hospital | Partial / Parcial | Medium / Media | Product Owner | 2026-08-25 |
| 014 | sesion-profesional-en-shell | Done / Completada | Medium / Media | Product Owner | 2026-08-25 |
| 015 | fidelidad-visual-hospital | Partial / Parcial | Medium / Media | Product Owner | 2026-08-25 |
| 016 | acceso-de-soporte-administrativo | Partial / Parcial · MP02 pendiente | High / Alta | Product Owner | 2026-08-25 |
| 017 | worklist-del-visitador | Partial / Parcial · MP02 pendiente | High / Alta | Product Owner | 2026-08-25 |
| 018 | correcciones-visitador-mp02 | Approved / Aprobada · sin consentimiento | High / Alta | Product Owner | 2026-08-25 |
| 021 | paciente-mvp-operativo | Approved / Aprobada · sin consentimiento | High / Alta | Product Owner | 2026-08-26 |
| 022 | sesion-institucional-alcaldia-mvp | Approved / Aprobada · consentida | High / Alta | Product Owner | 2026-08-27 |
| 023 | staging-controlado-hostinger | Approved / Aprobada · consentida | High / Alta | Product Owner | 2026-08-27 |
| 024 | bootstrap-tenant-enforce | Approved / Aprobada · consentida | High / Alta | Product Owner | 2026-08-28 |
| 026 | experiencia-visual-responsiva-demo | Approved / Aprobada · pendiente de consentimiento SDD | High / Alta | Product Owner | 2026-09-17 |
| 027 | portal-central-cuenta-paciente-persistente | Draft / Borrador (reconciliado en 038; cuarentena OD-12) | High / Alta | Product Owner | 2026-09-18 |
| 028 | identidad-humana-completar | Approved / Aprobada | High / Alta | Product Owner | 2026-09-19 |
| 029 | recuperacion-build-docker | Approved / Aprobada · consentida | Critical / Crítica | Product Owner | 2026-09-21 |

## Auditoría de Codex

| | Specs | Cuáles |
|---|---|---|
| Con auditoría registrada | 7 | 001–007 |
| **Sin auditoría registrada** | **10** | **008–017** |

Las diez sin auditoría son todas las capacidades que tocan datos, identidad,
permisos y aislamiento institucional. Es el hallazgo abierto más relevante de
esta radiografía.

**Matiz del 2026-08-25.** Codex sí auditó el micropaquete MP02 de la spec 017
—veredicto `PASS WITH CORRECTIONS`— y ese veredicto se registró en la propia
spec, no en `reviews/`, que está congelado. El recuento de arriba se refiere a
auditorías registradas en `reviews/` y sigue siendo exacto para MP01 y para las
otras nueve specs. La spec 018 nació de ese veredicto y todavía no tiene código
que auditar.
| 030 | hospital-demo-api-local | Approved / Aprobada · pendiente de consentimiento SDD | High / Alta | Product Owner | 2026-09-21 |
| 031 | hospital-visits-demo-local | Approved / Aprobada · consentimiento SDD recibido | High / Alta | Product Owner | 2026-09-21 |
| 032 | hospital-agenda-canvas-demo | Approved / Aprobada · consentimiento SDD recibido | High / Alta | Product Owner | 2026-09-22 |
| 034 | caregiver-visitador-liquidations-demo | Approved / Aprobada · consentimiento SDD recibido | High / Alta | Product Owner | 2026-09-22 |
| 035 | central-access-institutional-approval | Approved / Aprobada · consentimiento SDD recibido | Critical / Crítica | Product Owner | 2026-09-23 |
| 036 | patient-demo-autofill | Approved / Aprobada · consentimiento SDD recibido | Medium / Media | Product Owner | 2026-09-23 |
| 037 | local-oidc-recovery | Approved / Aprobada · consentimiento SDD recibido | High / Alta | Product Owner | 2026-09-24 |
| 038 | demo-funcional-accesos-ficticios | Approved / Aprobada · consentimiento SDD recibido | Critical / Crítica | Product Owner | 2026-09-24 |

## Término funcional — seguimiento desde 2026-10-08

| Número | Nombre | Estado | Prioridad | Responsable | Actualización |
|---|---|---|---|---|---|
| 039 | termino-s00-base-y-baseline | MP01 aceptado; MP02/03/04A verificados; MP04B propuesto, decisión PO pendiente; Git local | Crítica | Product Owner / Codex | 2026-10-08 |

D-01 selecciona la copia fuera de OneDrive, rama S00 y base local 9980582. La spec 039 no hereda consentimiento de 025/038. Ver docs/plan-funcional/00-BASE-Y-BASELINE.md y el handoff S00-2026-10-08.md.
