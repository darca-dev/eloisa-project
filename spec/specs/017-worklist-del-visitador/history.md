# Historial 017-worklist-del-visitador

> Spec **as-built**: documenta trabajo ya implementado antes de la adopción de
> SDD (2026-08-25). Este historial se generó desde `git log`, no desde memoria.
> Cada fila es un commit real; la columna «Rama» dice en cuál vive, porque no
> todos están en `develop`.

## Commits

| Fecha | Commit | Rama | Asunto | Archivos |
|---|---|---|---|---|
| 2026-08-25 | `fb871e7` | `develop` | docs(visitador): add professional worklist API task | 1 |
| 2026-08-25 | `15a9ae1` | `develop` | feat(visitador): add professional worklist api | 5 |
| 2026-08-25 | `6a54de9` | `develop` | docs(visitador): add visible worklist agenda task | 1 |
| 2026-08-25 | `cffbf6b` | `wip/visitador-mp02-20260825` | wip(visitador): preserve mp02 implementation | 6 |

`cffbf6bd7b5e19a4fb712467e928f92698b18b99` **no está en `develop`.** Preserva la
implementación de MP02 que hasta entonces vivía sin control de versiones en una
sola copia de trabajo: seis archivos, 2.763 líneas añadidas, ninguna
modificación a archivo existente. La rama se subió a
`origin/wip/visitador-mp02-20260825`. No se fusionó, no se ejecutó ninguna de
sus dos suites y no está aprobada. Su contenido **sí** fue revisado después:
ver «Auditorías» al final de este archivo.

## Cambios documentales

| Fecha | Qué cambió | Por qué |
|---|---|---|
| 2026-08-25 | `spec.md`, `plan.md`, `tasks.md` e `history.md` de esta spec | El commit `cffbf6b` volvió falsas varias afirmaciones que eran ciertas en el corte del 2026-08-25 —sobre todo «no tiene implementación posterior en ninguna rama» (`spec.md`), «No hay commit posterior en ninguna rama» (`plan.md`) y los seis archivos declarados como inexistentes (`tasks.md`). Se corrigieron sin cambiar el estado de aprobación de la spec, sin declarar pruebas ejecutadas y sin tocar código de aplicación. Autorización expresa del Product Owner. Registro completo en `spec/bitacora/global/PROJECT_LOG.md` |
| 2026-08-25 | `spec.md`, `plan.md`, `tasks.md` e `history.md` de esta spec | El Product Owner aprobó el alcance de B1 y B2 y mantuvo B3, B4 y B5 pendientes. Se registró la aprobación en `spec/bitacora/decisiones/` y se reflejó en la spec sin cambiar su estado de aprobación, sin marcar ninguna casilla como completada, sin ejecutar `confirm-user-consent.sh` y sin escribir código. La compuerta SDD sigue cerrada |
| 2026-08-25 | `spec.md`, `plan.md`, `tasks.md` e `history.md` de esta spec | Codex auditó MP02 sobre `cffbf6b` y devolvió `PASS WITH CORRECTIONS`, con `SAFE TO INTEGRATE INTO DEVELOP: NO` y `SPEC 017 READY FOR APPROVAL: NO`. Se registran las seis correcciones bloqueantes B1–B6, se separan del hardening recomendado posterior y se listan las cuatro decisiones de producto que faltan para poder ejecutar B3, B4 y B5. Se corrigieron además las afirmaciones que la auditoría volvió falsas —«no se ha leído ni revisado el contenido» y «no existe auditoría de Codex», hoy ciertas solo para MP01—. Sin código, sin tocar la rama WIP, sin merge, sin pruebas ejecutadas y sin cambiar el estado de aprobación. Autorización expresa del Product Owner |

## Decisiones del Product Owner

| Fecha | Decisión | Registro |
|---|---|---|
| 2026-08-25 | Aprobado el **alcance** de B1 (fail-closed de `visit`) y B2 (validación de ventana). B3, B4 y B5 quedan pendientes. La ejecución sigue bloqueada: SDD no admite aprobación parcial y la compuerta continúa cerrada | `spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md` |
| 2026-08-25 | Elegida la «vía B»: B1 y B2 se trasladan a una spec nueva y acotada, `018-correcciones-visitador-mp02`, para que el permiso registrado coincida con el alcance aprobado sin aprobar la spec 017 completa | `spec/specs/018-correcciones-visitador-mp02/` |

## Auditorías

| Fecha | Alcance | Fuente | Veredicto |
|---|---|---|---|
| 2026-08-25 | MP02, código de `wip/visitador-mp02-20260825` (`cffbf6b`) | Auditoría independiente de Codex, trasladada por el Product Owner | `PASS WITH CORRECTIONS` · `SAFE TO INTEGRATE INTO DEVELOP: NO` · `SPEC 017 READY FOR APPROVAL: NO` |

MP01 sigue sin veredicto de auditoría. `reviews/` está congelado y no contiene
ninguna entrada `VISITADOR`: este veredicto vive en la spec, que es su ubicación
canónica desde la adopción de SDD.
