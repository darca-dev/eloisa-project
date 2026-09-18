# Decisión importante — Estado de ramas tras la auditoría Git y qué NO se hace todavía

## Fecha

2026-08-25

## Contexto

El Product Owner encargó una auditoría Git del repositorio, entregada el
2026-08-25 (`Auditoria 25_8_2026.docx`). Se ejecutó sobre la copia de trabajo
`C:\Users\10plu\ElI-MERDN` y **no modificó ninguna rama, commit, archivo ni
historial**.

Sus conclusiones se verificaron de forma independiente el mismo día contra el
remoto desde la copia de trabajo `/Users/juanklagos/www/El-MERDN`. La
verificación confirma lo esencial y añade un hallazgo que la auditoría no
destaca (ver más abajo).

### Estado medido

| Referencia | SHA | Situación |
|---|---|---|
| `main` | `fae478a` | 133 commits por detrás de `develop`; sin ningún commit exclusivo |
| `develop` | `6a54de9` | Línea principal; sincronizada con `origin/develop` |
| `wip/eloisa-admin-mp02-20260825` | `6b0c74d` | 1 commit exclusivo |
| `wip/pre-fidelity-20260824` | `4c0e5a0` | 3 commits exclusivos |
| `origin/desarrollar` | `fae478a` | Mismo SHA que `main`; rama histórica |

Sin stashes activos, sin tags, sin merge commits, sin ramas ocultas en GitHub.
Los 17 objetos inaccesibles revisados no contenían archivos recuperables.

### Trabajo exclusivo fuera de `develop`

1. **Admin Support MP02** — `apps/api/src/support-access/` (contract, module,
   service, guard) más `apps/api/test/support-access.service.db.test.ts`.
   Cubre autorización, separación `HumanPrincipal`/`SupportPrincipal`, TTL,
   *idle timeout*, revocación, RLS, aislamiento entre tenants, rollback de
   auditoría, cookies independientes, tokens `HttpOnly` y fallo cerrado.
2. **Configuración institucional local** — `.env.example` y `compose.yml` con
   `MERDN_HOSPITAL_PATIENT_VIEWER` y `MERDN_HOSPITAL_SCHEDULER`, sin secretos
   reales y con comportamiento fail-closed (`45b12e2`).
3. **Una prueba de compatibilidad de rol** — un rol del servidor todavía sin
   rotular cae en la etiqueta neutra (`75135e8`). Solo la prueba: el archivo
   completo de 962 líneas es una versión anterior.
4. **Cargador local de datos de demostración** — `tools/hospital-local-data/`
   (`4c0e5a0`), con *dry-run*, RLS, tenant y rol de carga restringido.
   Verificado sin `DELETE FROM`, `DROP TABLE`, `TRUNCATE`, `git reset`,
   `git clean`, `git checkout` ni `push --force`.

### Hallazgo adicional de la verificación independiente

**Ninguna de las dos ramas WIP puede fusionarse completa.** Ambas bifurcaron de
un punto anterior y su diferencia neta contra `develop` es en parte una
regresión:

- `wip/eloisa-admin-mp02-20260825` **elimina** respecto a `develop`
  `apps/api/src/visits/professional-visit-worklist.service.ts` (341 líneas),
  buena parte de `visits.dto.ts` (331) y 548 líneas de `visits.api.test.ts`,
  además de las Task Specifications del visitador. Bifurcó antes de esa
  capacidad. Un merge de la rama completa haría retroceder el módulo de visitas.
- `wip/pre-fidelity-20260824` presenta un neto de **−22.220 líneas**.

Esto refuerza la recomendación de la auditoría —recuperación selectiva— y le da
una razón medida: no es prudencia general, es que el merge completo perdería
trabajo existente.

### Trabajo activo no committeado

La auditoría identifica `apps/web/src/app/visitador/` y
`apps/web/src/features/visitador/` como trabajo local sin commit, y lo clasifica
como riesgo **CRÍTICO**.

**Ese trabajo no existe en la copia `/Users/juanklagos/www/El-MERDN`**, cuyo
árbol está limpio. Vive únicamente en la copia de trabajo del auditor. No puede
protegerse desde aquí.

## Decisión

**No se ejecuta ninguna operación Git. El estado queda registrado y a la espera
de decisión del Product Owner.**

En concreto, y hasta autorización expresa, no se hace: crear `development`,
fusionar ramas, hacer *cherry-pick*, borrar ramas, tocar `main`, eliminar
worktrees ni limpiar objetos Git. La auditoría misma se detiene en el mismo
punto y condiciona la ejecución a una aprobación explícita.

Esto es coherente con `CLAUDE.md` §12.3 —ninguna autorización para implementar
es autorización para integrar— y §9.9 —cualquier operación sobre `main` es una
STOP CONDITION.

## Alternativas consideradas

**Ejecutar ya la recuperación selectiva de las cuatro piezas.** Rechazada. El
riesgo principal identificado es cambiar de rama antes de proteger el trabajo de
Visitador, y ese trabajo no está en esta copia: cualquier operación desde aquí se
haría a ciegas sobre el riesgo crítico.

**Fusionar `wip/eloisa-admin-mp02` completa para recuperar MP02.** Rechazada por
la verificación independiente: haría retroceder el módulo de visitas.

**No registrar nada hasta que se decida.** Rechazada. El estado medido caduca:
`develop` avanzó de `fb871e7` a `6a54de9` durante la propia auditoría. Dejarlo
sin registrar obliga a volver a medirlo.

## Consecuencias

Queda escrito, con SHA exactos, qué trabajo vive fuera de `develop` y por qué no
puede recuperarse con un merge. Cualquier ejecución futura parte de este registro
en vez de volver a auditar.

Trade-off aceptado: mientras no se ejecute, el Admin Support MP02 sigue existiendo
solo en una rama WIP y el trabajo de Visitador sigue sin proteger en una única
máquina. Es el estado real, y registrarlo no lo empeora.

Efecto sobre las specs as-built: las specs `016-acceso-de-soporte-administrativo`
y `017-worklist-del-visitador` describen `develop`. Ambas deben declarar que su
micropaquete MP02 no está en esta rama y dónde está realmente.

## Cuándo revisar esta decisión

- Cuando el Product Owner autorice la ejecución de la reorganización.
- Si `develop` avanza: los SHA de este registro dejan de describir el estado y
  hay que volver a medir antes de ejecutar nada.
- Si el trabajo de Visitador se commitea o se pierde: en ambos casos cambia el
  riesgo principal.
- Si se decide que otra copia de trabajo pasa a ser la de referencia.

## Registros relacionados

Primer registro sobre estado de ramas. No reemplaza a ninguno.
