# Plan 011 - Identidad humana y relaciones paciente-cuidador

## Resumen

> **RETROSPECTIVO.** Este plan no propone trabajo: reconstruye, desde
> `history.md` y desde el código, cómo se ejecutó realmente
> `IDENTITY-RELATIONSHIPS-CORE-01` entre el 2026-08-22 y el 2026-08-24, antes de
> que MERDN adoptara SDD el 2026-08-25. Las fases están descritas en pasado
> porque ya ocurrieron.

La capacidad se construyó como un núcleo compartido: autenticar a una persona
contra un proveedor OIDC, derivar en el servidor qué es esa persona dentro de la
institución, y modelar la relación paciente-cuidador como una autorización con
finalidad, alcance, vigencia y revocación propias. El objetivo declarado era
desbloquear los gates de identidad de `VISITS-CORE-01` sin implementar Visitas.

Lo que distingue este trabajo de los anteriores es que las decisiones se
separaron de la implementación de forma explícita: primero un paquete de
decisiones para el Product Owner, después un paquete técnico cerrado para el
agente implementador, y solo entonces código. El resultado es una base de datos
inusualmente estricta y una superficie de API deliberadamente pequeña.

## Contexto técnico

- **Monorepo** npm workspaces: `apps/api` (NestJS), `apps/web` (Next.js),
  `prisma/`, `tools/`, `infra/`.
- **Persistencia**: PostgreSQL con Prisma, rol de ejecución `merdn_runtime` sin
  `BYPASSRLS`, tenant resuelto en servidor mediante `TenantContextService` y
  `withTenant()`. Todo heredado de las specs 001 y 007.
- **Extensión requerida**: `btree_gist`, sin la cual la exclusion constraint
  contra relaciones activas solapadas no puede existir.
- **Dependencia nueva**: `openid-client`, única biblioteca añadida. El packet
  §13 exigía justificarla y fijarla, y prohibía cualquier otra dependencia mayor.
- **Proveedor OIDC local**: Keycloak `26.7.1` en un servicio Compose opt-in tras
  el perfil `oidc-local`, publicado solo en `127.0.0.1`, con emisor canónico
  `http://host.docker.internal:8081/realms/merdn-local` para que navegador y
  contenedor de la API alcancen exactamente el mismo `iss`.
- **Tres clases de cookie distintas y no intercambiables**: inscripción
  (spec 007), institucional (spec 008) y humana (esta spec,
  `merdn_human_session`).
- **Restricción de entorno**: emisor local o sin TLS solo se admite en
  `development` y `test`; el marcador `merdn-local` queda prohibido en `mvp`.

## Fases de implementación (ejecutadas)

### Fase 1 — Diseño de la Task (2026-08-22)

Commit `ec23773`, *Add Identity Relationships CORE-01 design*. Un archivo:
`tasks/IDENTITY-RELATIONSHIPS-CORE-01.md`. Definió el alcance del núcleo
compartido y dejó abiertas seis decisiones en su §17, que ningún agente podía
resolver por su cuenta.

### Fase 2 — Paquete de decisiones al Product Owner (2026-08-22)

Commit `4761e4d`, *Add Identity Relationships owner decision packet*. Un archivo:
`tasks/IDENTITY-RELATIONSHIPS-CORE-01-OWNER-DECISION-PACKET.md`. Convirtió las
seis decisiones abiertas en una propuesta única, cada una con su recomendación,
su justificación, su impacto en el MVP y su requisito diferido antes de datos
reales. El Product Owner aprobó el bloque el 2026-08-23 con una condición
vinculante: ninguna dependencia OIDC externa podía bloquear el MVP.

### Fase 3 — Cierre técnico y paquete ejecutable (2026-08-23)

Commit `b1b0256`, *Finalize Identity Relationships CORE-01 packet*. Tres
archivos. Resolvió la condición del Product Owner sustituyendo Entra External ID
por Keycloak local desechable, manteniendo un único contrato OIDC estándar y
dejando Entra como configuración futura. Produjo el `CLAUDE-PACKET`, que fija
modelo de datos, contratos de API, política de sesión, auditoría, RLS, allowlist
de archivos, quince criterios de aceptación y doce STOP CONDITIONS.

### Fase 4 — Paquete de continuación tras parada controlada (2026-08-23)

Commit `ec7950f`, *Add Identity Relationships continuation task*. Un archivo:
`...-CONTINUATION.md`. Registró un checkpoint: el esquema, la migración, el
adapter, la sesión, los resolutores, el guard del gestor y la auditoría ya
existían, pero el realm de Keycloak fallaba al importarse y faltaba el comando de
aprovisionamiento. Diagnosticó la causa raíz —opciones de PKCE y post-logout
declaradas como propiedades de primer nivel del cliente en vez de bajo
`clients[].attributes`— y prohibió expresamente reescribir el adapter por un
problema de fixture. Fijó además el emisor canónico `host.docker.internal` para
que el contenedor de la API pudiera alcanzar el mismo issuer que el navegador.

Un micro-paquete asociado, `...-MICRO-01-KEYCLOAK-REIMPORT.md`, acotó la
reimportación a diez minutos, cero archivos modificados y dos comprobaciones de
discovery.

### Fase 5 — Implementación (2026-08-24)

Commit `03255de`, *feat(identity): add human auth and relationship core*. **61
archivos.** Es el commit central de la capacidad y entregó, de una vez:

- migración aditiva `20260823120000_identity_relationships_core_01` (616 líneas)
  y su rollback (137 líneas): seis tablas, ocho enums, checks, trigger
  tenant-aware, exclusion constraint `btree_gist`, grants sin `DELETE` y RLS
  forzada con políticas por tenant;
- `apps/api/src/human-auth/` completo: adapter OIDC único, intento cifrado,
  cookie, guard de sesión, guard de origen, límite de tasa, controladores de
  `login`/`callback`/`session`/`logout` y `me/contexts`;
- `apps/api/src/identity-access/`: principal humano y resolutores de
  participación;
- `apps/api/src/people-relationships/`: contrato cerrado, política de
  autorización de cuidador y superficie de gestión con concurrencia optimista;
- `apps/api/src/audit/identity-audit.service.ts`: ocho eventos nuevos con la
  regla de atribución por clase de actor;
- `tools/identity-provisioning/`: comando administrativo con `--dry-run` por
  defecto y `LINK`/`UNLINK`/`DISABLE_ACCOUNT`;
- `infra/local-oidc/` y el servicio `oidc-local` en `compose.yml`;
- pruebas: `human-auth.api.test.ts`, fixtures compartidas y siete suites
  unitarias.

### Fase 6 — Cierre del gate profesional con evidencia PostgreSQL (2026-08-24)

Commits `7662f6e` (*Add MP03-B visits identity gate task*) y `c696752`
(*test(identity): prove professional assignment access in postgres*). El paquete
MP03-B fue deliberadamente estrecho: **un solo archivo permitido**,
`apps/api/test/identity-professional-assignment.db.test.ts`, con prohibición
expresa de tocar `apps/api/src/**`, `prisma/**`, `apps/web/**` y
`prototype-claude/**`, y con la instrucción de detenerse si la prueba revelaba un
defecto de runtime en vez de corregirlo.

El resultado son 16 casos que recorren la cadena completa bajo el rol
`merdn_runtime` real: sesión → principal → perfil activo → afiliación vigente →
asignación viva, más denegaciones focales por otro profesional, otro paciente,
otro tenant, asignación inactiva, asignación vencida y contexto de tenant
ausente. Es la única evidencia PostgreSQL de esta capacidad.

## Dependencias

Ver la tabla completa en `spec.md`. En resumen ejecutivo:

- **001** aportó Prisma, PostgreSQL, Compose y validación tipada de entorno.
- **007** aportó `Tenant`, `Person`, `Patient`, `AuditEvent`, RLS y el rol
  `merdn_runtime`. Esta capacidad no crea identidad: la reutiliza.
- **008** aportó `InstitutionalIdentity`, `InstitutionalSession` y el patrón de
  guard que `CAREGIVER_RELATIONSHIP_MANAGER` extiende sin alterar.
- **009** fijó la convención de roles institucionales aditivos y disjuntos.
- **010** aportó `ProfessionalProfile`, `ProfessionalAffiliation` y
  `CareAssignment`, que son exactamente lo que consultan los resolutores.

Externas: PostgreSQL con `btree_gist`; un proveedor OIDC (Keycloak local en
desarrollo); las variables sin valor por defecto enumeradas en `spec.md`.

Consumidoras: 012, 013, 014, 016 y 017.

## Hitos

| Hito | Fecha | Evidencia |
|---|---|---|
| Task de diseño publicada | 2026-08-22 | `ec23773` |
| Decisiones abiertas convertidas en propuesta única | 2026-08-22 | `4761e4d` |
| Aprobación en bloque del Product Owner, con condición | 2026-08-23 | `OWNER-DECISION-PACKET`, registro de aprobación |
| Condición cerrada; Keycloak local sustituye a Entra | 2026-08-23 | `b1b0256`, `CLAUDE-PACKET` §AD-01 |
| Parada controlada y continuación acotada | 2026-08-23 | `ec7950f` |
| Núcleo implementado en un solo commit de 61 archivos | 2026-08-24 | `03255de` |
| Gate profesional probado en PostgreSQL | 2026-08-24 | `c696752` |
| Auditoría de Codex | — | **No existe** |

## Riesgos (vigentes hoy)

1. **La capacidad de cuidador no tiene consumidor.** `canCaregiverViewVisits()`
   está construida y sin usar; ninguna superficie la consulta. El riesgo no es de
   seguridad —nadie ve de más— sino de producto: la capacidad más costosa de esta
   spec no llega a ninguna persona, y cuanto más tarde se conecte, más probable
   es que el consumidor la reimplemente en vez de reutilizarla. Ya ocurrió con
   los resolutores profesionales, que Visitas duplicó.
2. **El flujo OIDC feliz no está protegido por ninguna prueba.** Un cambio en
   `openid-client`, en la configuración del realm o en el emisor canónico puede
   romper el login sin que la suite lo note. La verificación existente fue
   manual y no se repite en CI.
3. **Las garantías DB más caras de esta migración no están probadas.** La
   exclusion constraint, el trigger contra autorrelación y la RLS de las seis
   tablas nuevas se crearon correctamente en el SQL, pero nadie ha comprobado
   contra un motor que se comporten como se espera. Una migración futura que las
   eliminara pasaría inadvertida.
4. **Relaciones caducadas quedan almacenadas como `ACTIVE`.** No hay
   materialización de `EXPIRED`. La autorización se deniega por vigencia, así que
   no es un agujero; pero cualquier lectura futura que confíe en la columna
   `status` en vez de en `endsAt` concedería acceso indebido. El riesgo está
   latente en el esquema, esperando a un consumidor descuidado.
5. **El límite de tasa es por proceso.** Un despliegue con varias instancias
   multiplica el presupuesto de intentos de `login` y `callback`.
6. **`HumanAuthAttempt` crece sin límite.** Sin limpieza física, la tabla acumula
   una fila por intento de autenticación indefinidamente.
7. **La identidad institucional gestora es compartida.** La auditoría identifica
   la credencial, no a la persona que operó. Es una decisión aprobada y
   documentada, y es el motivo por el que esta capacidad no puede tocar datos
   reales.
8. **Ninguna verificación independiente.** Sin auditoría en `reviews/`, los
   quince criterios de aceptación del packet solo están respaldados por quien
   implementó. Para la capacidad que decide quién ve qué, es el riesgo de proceso
   más serio de la lista.
9. **Entra External ID sigue sin integrarse.** El adapter está preparado y el
   cambio es de configuración, pero mientras no se ejecute, la única identidad
   posible es un contenedor local desechable con personas ficticias.
