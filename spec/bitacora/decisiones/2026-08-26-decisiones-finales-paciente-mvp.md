# Decisión — Cierre de las dos decisiones finales del Paciente MVP

- **Fecha:** 2026-08-26
- **Decide:** Product Owner
- **Tipo:** decisiones de **producto** (finales)
- **Spec afectada:** `spec/specs/021-paciente-mvp-operativo/` (§17.C)
- **Decisiones previas:** `2026-08-26-alcance-paciente-mvp.md` y
  `2026-08-26-decisiones-paciente-mvp.md`

## Contexto

El cierre anterior resolvió las nueve decisiones abiertas y dejó **dos
concreciones** pendientes: qué muestra `/` justo después de inscribirse, y qué
campos exactos lleva el resumen del Paciente. Este registro las cierra.

**Con esto, la spec 021 no tiene ninguna decisión de producto abierta.**

## Qué se decidió

### 1. Experiencia post-inscripción en `/`

Después de una inscripción exitosa:

- la **cookie de inscripción sirve únicamente para confirmar y completar la
  inscripción**;
- **no** se considera sesión permanente del portal Paciente;
- **no** se entra automáticamente a la experiencia autenticada de Paciente;
- la interfaz debe mostrar una **confirmación clara de «Inscripción completada»**;
- debe existir una **entrada separada «Ingresar como Paciente»**;
- el acceso al portal Paciente **requiere la sesión humana OIDC canónica** ya
  aprobada;
- para el MVP, las identidades de prueba y piloto se **aprovisionan mediante el
  mecanismo administrativo seguro existente**.

**No se crea autorregistro nuevo de identidad.**

### 2. Campos cerrados del resumen del Paciente

El resumen básico queda limitado **exactamente** a:

1. **nombre de pila**;
2. **iniciales**;
3. **etiqueta fija «Paciente»**.

**No** se muestran en ese resumen: documento; fecha de nacimiento; sexo o género;
EPS; territorio; diagnósticos; información clínica; identificadores técnicos;
información de terceros; **ni cualquier otro dato no incluido expresamente
arriba**.

## Por qué importa cada una

**La primera cierra un modo de fallo real.** Hoy `ExperienciaMerdn.tsx:80-92`
consulta `GET /api/v1/patients/me` en cada carga y, si hay paciente, sustituye la
inscripción por la experiencia de Paciente. Es decir: **la cookie de inscripción
es hoy lo que abre la experiencia**. La decisión retira ese papel de forma
explícita, y con él la posibilidad de que una credencial sin logout ni revocación
dé acceso a datos propios.

**La segunda hace verificable la minimización.** Una lista cerrada de tres campos
se puede probar por **igualdad de conjunto**: un cuarto campo añadido más tarde
hace fallar la prueba en vez de pasar desapercibido. Una descripción en prosa no
lo permite.

## Qué NO decide

- **No aprueba** la spec 021: su `Estado / Status` sigue en `Pendiente`.
- **No registra** el consentimiento SDD. Ese acto sigue pendiente y corresponde
  al Product Owner (`CLAUDE.md` §14.4).
- **No abre** la compuerta y **no** autoriza escribir código.

## Qué queda pendiente tras este cierre

**Cero decisiones de producto.** Quedan dos asuntos que el propio Product Owner
declaró de arquitectura y delegó en Codex (`spec.md` §17.D):

1. **Forma técnica de la auditoría.** Límite duro: aditiva, mínima, segura y
   explícita en la spec.
2. **Ubicación del cliente de sesión humana.** Límite duro: arquitectura
   existente y mínimo cambio.

Y los dos actos del Product Owner que abren la compuerta: **aprobar la spec** y
**registrar el consentimiento**.

## Consecuencias registradas el mismo día

- `spec.md`: se añadieron los requisitos §6.6-a a §6.6-d (entrada
  post-inscripción); se cerró §6.7 en tres campos; se actualizaron §7, §12, la
  lista de escenarios, los criterios EARS, las propiedades y §16; la §17.C pasó
  de «pendientes» a **cerradas**; y se añadieron las STOP CONDITIONS §19.12
  —cuarto campo en el resumen— y §19.13 —cookie de inscripción usada como sesión
  de portal—.
- Actualizados `plan.md`, `tasks.md`, `research.md`, `history.md`,
  `spec/specs/INDEX.md` y `spec/bitacora/global/PROJECT_LOG.md`.
- **Cero código, cero dependencias, cero cambios de esquema, cero migraciones,
  cero commits.**
