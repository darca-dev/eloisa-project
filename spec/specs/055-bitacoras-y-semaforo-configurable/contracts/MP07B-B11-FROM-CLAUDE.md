# 055-MP07B-B11 — Entrega de Claude conservada por Codex

Fecha: 2026-10-26. Codex transcribe el resultado real de la sesión Claude, exit0. Claude no pudo escribir este archivo por su permiso local; Codex lo conserva como documentación sin alterar la atribución de pruebas.

## Handoff 055-MP07B-B11 (para Codex)

**Estado:** el cambio de código está hecho y las pruebas focales pasan. La entrega `contracts/MP07B-B11-FROM-CLAUDE.md` **no se creó**: el permiso de escritura de archivos fue denegado (modo "don't ask") y no intenté sortearlo por otra vía. Su contenido es este resumen; si se habilita el permiso, la creo con este texto.

### Cambios (solo los 4 archivos permitidos)
1. `apps/api/src/care-criteria/care-criteria.contract.ts:91`: la etiqueta de `SIN_CRITERIOS` ahora dice exactamente `Sin criterios vigentes ni solicitudes abiertas: no hay evaluación automática`. El identificador, el cálculo y las demás etiquetas no cambian.
2. `apps/api/test/care-records-alarms.api.test.ts:1198`: a la aserción existente del criterio vencido se le añadió `label` con el texto exacto. No se quitó ninguna aserción: siguen `level`, conteos, `openAlarms`, `not.toBe('ESTABLE')`, `alarmsOpened: 0` y las comprobaciones de que no se modifican la versión, el criterio ni las alarmas.
3. `apps/web/src/features/care/care.test.tsx:237-243`: el fixture, la expectativa `Semáforo: …` y el título del caso usan el texto nuevo. Siguen `role="status"` y la comprobación de que no aparece verde.
4. `apps/web/src/features/care/careCriteriaViews.tsx:28`: solo se actualizó el comentario de cabecera.

No toqué motor, servicios, estados, permisos, esquema, migraciones, dependencias ni la documentación de Codex. No añadí pruebas nuevas.

### Comandos (cada uno ejecutado por separado en esta sesión)
| Comando | Exit | Resultado |
|---|---|---|
| `bash ./spec/scripts/check-sdd-gate.sh .` (antes de editar) | 0 | Gate ABIERTA, 0 errores, 19 avisos |
| `bash ./spec/scripts/validate-sdd.sh . --strict` (antes de editar) | 0 | 0 errores, 0 avisos |
| `npm run typecheck --workspace @merdn/api` | 0 | sin errores |
| `npm run typecheck --workspace @merdn/web` | 0 | sin errores |
| `npm exec -- eslint …` (los 4 archivos) | 0 | sin salida |
| `npm run test --workspace @merdn/api -- src/care-criteria` | 0 | 1 archivo, 17/17 pasan |
| `npm run test --workspace @merdn/web -- src/features/care` | 0 | 3 archivos, 48/48 pasan |
| `git diff --check` | 0 | solo avisos de cambio LF→CRLF, ningún error |

En la prueba unitaria de la API aparece un `prisma:error` que dice "Can't reach database server at 127.0.0.1:1". Era de esperar con el DSN ficticio del puerto 1 y no hizo fallar ninguna prueba.

### No ejecutado
- La suite PostgreSQL de 43 casos, que incluye la aserción ampliada: queda sin verificar hasta que la ejecute Codex.
- No usé DB, Docker, navegador ni servidores, no hice operaciones Git que modifiquen nada y no registré consentimientos.
- Los cambios documentales que ya existían quedaron intactos. Esto no es aceptación integral de 055.
