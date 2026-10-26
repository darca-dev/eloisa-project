# Dictamen de lectura: 055, cierre técnico (Claude Code, 2026-10-26)

**No encontré ningún defecto de código que se pueda reproducir en lo que revisé. El estado técnico es coherente con un cierre listo para la auditoría final de Codex, pero la documentación canónica sigue atrasada y debe corregirse antes de presentar el cierre al PO.**

En esta sesión no ejecuté nada: ni pruebas, ni base de datos, ni navegador, ni Git. Las cifras de 34 etapas, 2690 pruebas y 12/12 en el navegador vienen de la evidencia saneada del 23/10 y no las verifiqué. Este dictamen no es aceptación, ni validación clínica, ni ratificación de decisiones del PO, ni autorización de despliegue.

## 1. Puntos pedidos

### B10: guardas de imports y anuncios accesibles. Se conservan.
- **Imports** (`apps/web/src/features/hospital/hospitalAlcance.test.ts:274-374`):
  - `IMPORTS_AUTORIZADOS` no cambió y la excepción vale para un solo archivo (`{'HospitalShell.tsx': ['next/link']}`).
  - Las pruebas comprueban que la excepción se usa de verdad y que el mapa es exacto (`:339-346`). También comprueban que se rechaza `next/link` en otro archivo y que en el shell se rechazan `next/navigation` y `axios` (`:348-374`).
  - `PROHIBIDO_SIEMPRE` (transporte, persistencia, telemetría, entorno) sigue intacto.
  - En el código, el único import externo nuevo es `HospitalShell.tsx:2`.
- **Anuncios accesibles** (`apps/web/src/features/paciente/paciente.test.tsx:669-690`): no es un simple cambio de 2 a 1. La prueba exige:
  - la identidad de la región del portal (`#paciente-portal-sesion`, `role="status"`, `aria-live="polite"`);
  - que no haya `aria-live` en la sección de cuidado;
  - que dentro de ella estén `role="status"` y `TEXTO_ESTADO_GENERAL.cargando`.

  Se cumple lo que pide `MP07B-REGRESION-WEB.md` §B10.2.
- **Límites de cobertura (no son defectos):**
  - El parser de imports (`:290-294`) solo detecta `from '…'` con comillas simples. No ve comillas dobles, `import 'x'`, `import()` dinámico ni `require`. La limitación ya existía y B10 no la amplió.
  - La guarda no es transitiva. `HospitalShell.tsx:15` importa `@/features/care/CareWorkspace`, que conecta por su propio cliente, y esa red no la vigila esta prueba.
  - B10.2 depende de que no haya secciones anidadas en el estado inicial (`:678`). Claude ya lo declaró como supuesto.

### `decideManyWithin`: el filtrado por acción no amplía permisos
- `care-context.policy.ts:263-278`:
  - bloquea las concesiones de las acciones pendientes juntas;
  - decide cada acción solo con las concesiones de *su* permiso (`candidate.permission === permission && candidate.actorKind === actorKind`);
  - construye el `Scope` con esa acción, así que `issuedByManager` (autoconcesión, `:742-747`) y `REVIEWER_PERMISSIONS` (`:724`) se evalúan por acción.
- `lockGrants` (`:666-695`) mantiene los filtros de tenant, organización, contexto, paciente, cuenta, finalidad, estado y vigencia. `pinned: null` impide usarla para ASSIGN; A09 sigue en `decideWithin`.
- El consumidor (`care-context-directory.service.ts:139-147`) usa `granted.get(permission)` para el trabajo, o sea, la autorización de la acción pedida.
- **Límite de las unitarias confirmado:**
  - El spy (`care-context.policy.test.ts:110-113`) devuelve la misma concesión clonada para cada acción pedida, con el mismo id y el mismo `actorKind`.
  - Si se quitara el filtro `candidate.permission === permission`, las 11 pruebas de equivalencia (`:236-260`) seguirían pasando.
  - Esa regresión sí la detectaría PostgreSQL, donde hay conjuntos parciales de concesiones: `care-records-alarms.api.test.ts:183` (profesional sin `REQUEST_ALARM`/`REVIEW_ALARMS`), `:186` y `:1619` (cuidadora solo con `CONTRIBUTE_RECORDS`).
  - Siguen sin cubrir:
    - una misma cuenta con concesiones de varios `actorKind` en un contexto;
    - una revocación concurrente durante la decisión múltiple.
- **Observación menor, no amplía permisos:** el `actorKind` de la entrada del directorio sale de la primera acción concedida (`directory.service.ts:203`). Si una cuenta tuviera concesiones de cuidador y de revisor, la entrada diría `CAREGIVER` aunque `actions` incluya `REVIEW_ALARMS`. Es solo una imprecisión de presentación.

### Semáforo con criterio vencido → `SIN_CRITERIOS`, sin estabilidad
- `care-criteria.service.ts:319-333`: `validUntil <= now` deja la versión fuera de los dos conteos. Si no hay alarmas abiertas, `semaphoreLevel` (`criterion-evaluator.ts:170-177`) devuelve `SIN_CRITERIOS`, nunca `ESTABLE`.
- El reloj no reescribe nada: la prueba `api.test.ts:1171-1206` comprueba que la versión sigue ACTIVE, que `supersededAt` sigue en null y que no se crean alarmas.
- Los conteos de revalidación coinciden con `requiresRevalidation`, porque `CareObservableStatus` solo tiene `ACTIVE | RETIRED` (`schema.prisma:2307`).
- **Falta precisión, no falsa estabilidad:** el texto «Sin criterios ni solicitudes» (`care-criteria.contract.ts:91`) aparece aunque exista un criterio, solo que vencido. El revisor no puede distinguir «nunca configurado» de «configurado y vencido». FR08 se cumple («no existe evaluación aplicable»). Elegir entre esto y `SIN_EVALUACION` es una **decisión pendiente del PO**, que no ratifico. No hay registro de que Codex o el PO la hayan resuelto.
- **Riesgo residual que no está en el cierre:** una alarma abierta clasificada ESTABLE sigue dando `ESTABLE` después de que venza la regla que la originó, hasta que una persona la cierre. El contrato lo pide así (A01: «no cambiar por reloj»), pero conviene que el PO lo vea explícitamente.

### AC01–AC12
No encontré un AC contradicho por el código que revisé. Lo que revisé respalda AC03, AC05, AC09 (parcial) y AC12 (`TEXTO_MOTOR_HOSPITAL`, `CareWorkspace.tsx:77-80`). Los demás AC dependen de ejecuciones del 23/10 que no reproduje.

AC11 («revocación concurrente») está cubierto en la fundación para `decideWithin` y A09, pero **no en el camino múltiple**. Recomendación, no requisito: que Codex lo registre como límite de cobertura de AC11 y no como «Cumple» sin matiz.

## 2. Discrepancias documentales para Codex

1. **`spec.md:11`**: el «Estado de ejecución» todavía dice que la auditoría de MP01–MP06 «requiere correcciones». No menciona MP07 ni el cierre.
2. **`tasks.md:33`**:
   - dice que la baseline está «detenida en web1900/1902 por B10»;
   - A02, A05, A06, A08 y A10 (`:43-47`) y la reejecución final (`:48`) siguen sin marcar;
   - MP01–MP06 (`:19-24`) también siguen sin marcar. Codex tiene que decidir cómo reflejarlos después de MP07.
3. **`history.md:58`** termina con B10 pendiente. Faltan:
   - la entrega de B10;
   - `codex055-final` (34/34, 2690);
   - Chromium `baseline-20261023t215834`;
   - la revisión de cierre de Claude;
   - los commits 527bdae y e94e400.
4. **`INDEX.md:140`**: «baseline web1900/1902 por B10 en corrección».
5. **`MP07-VERIFICACION-CODEX.md:61`** («Pendiente entrega y baseline completa») y **`MP07B-REVISION-CODEX.md:5`** («B10, en corrección») no tienen seguimiento posterior.
6. **`MP07B-FROM-CLAUDE.md`**:
   - **Contradicción:** §0b (`:33`) dice que Claude no ejecutó el navegador, y `:84` atribuye a Claude el run `baseline-20261023t215834` «sobre el árbol posterior a B08/B09/B10». Hay que aclarar el orden temporal.
   - **Más grave:** la ejecución por Claude contradice MP07 §6 («Codex ejerce PostgreSQL/navegador»). `055-CIERRE-REVISION-CLAUDE.md:9` la presenta como excepción autorizada por el PO, pero **no existe ningún registro de decisión del 23/10** en `spec/bitacora/decisiones/` (solo encontré `2026-10-26-055-continuacion-y-revision-claude.md`, que cubre la lectura). Codex debe confirmar con el PO y registrarla, o repetir las ejecuciones con sus propios arneses.
7. **`055-CIERRE-REVISION-CLAUDE.md`**:
   - `:3` y `:28` dicen «base 43d94b1» y «sin commits de esta tarea»;
   - `:26` usa `git diff HEAD -- prisma/migrations` como referencia.

   Desde 527bdae y e94e400 eso ya no describe HEAD: la migración 30 está commiteada. Hay que anotar qué commit cubre la evidencia del 23/10 y con qué autorización se hicieron los commits. Que la evidencia del 23/10 se ejecutara sobre el árbol que luego se commiteó en 527bdae es un supuesto que no puedo verificar.
8. **Riesgo residual 4 del cierre** (`SIN_CRITERIOS`) sigue como «pendiente de ratificar» sin dueño ni fecha. Debería figurar como decisión abierta del PO en `tasks.md`/`spec.md` §17.

## 3. Lo que no revisé
- No releí las pruebas de A02, A03, A04, A06, A07, A08 ni A09, ni la migración 30, RLS o el SQL de triggers. Para esos puntos me apoyo en la verificación previa de Codex en MP07A.
- No inspeccioné la suite del navegador (`care-browser.real.test.ts`) ni los resultados de axe.
- No verifiqué que los archivos `.tmp/*.json` existan ni su contenido (están excluidos por instrucción).
- No comparé 527bdae con la allowlist de MP07 ni de B10.

## Recomendaciones (de Claude, sin valor de decisión)
1. Que Codex añada una prueba unitaria con concesiones **distintas por acción** (por ejemplo, solo `VIEW_RECORDS` de cuidador más `REVIEW_ALARMS` de revisor) para que quitar el filtro por permiso haga fallar las unitarias, no solo PostgreSQL.
2. Que Codex resuelva la discrepancia 6 antes de presentar el cierre al PO.
