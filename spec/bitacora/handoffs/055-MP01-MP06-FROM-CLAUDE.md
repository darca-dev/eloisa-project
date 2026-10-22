# SPEC 055 — Entrega consolidada de Claude Code a Codex (MP01–MP06)

Fecha: 2026-10-21. Estado: **implementado y verificado localmente, pendiente de auditoría de Codex y de aceptación del Product Owner.** No hubo commit, push, PR ni despliegue. Toda ejecución de base se hizo en el clúster efímero `merdn-baseline-test` con el runner de la spec 025, que quedó limpio. La pila local del usuario (`merdn-*`) no se tocó.

## Autoridad

- El PO pidió «termina el semáforo» y «después de terminar este semáforo continúa con los demás, acceso total». Se interpretó como autorización para avanzar sin esperar cada auditoría; **no** como autorización de Git ni despliegue.
- Decisiones del PO registradas en `bitacora/decisiones/2026-10-21-055-administracion-permisos-y-d04-5.md`: concesiones desde una pantalla del gestor, y D04.5 conservador.
- MP04–MP05 y MP05b no tenían contrato de Codex. Claude Code los redactó a partir de D02–D07 (`contracts/MP04-05-CRITERIOS-ALARMAS-Y-SEMAFORO.md`). **Requieren revisión de Codex como especificación**, no solo como código.

## Entregas por paquete

| Paquete | Detalle | Migración |
|---|---|---|
| MP01 custodia y permisos | `contracts/MP01-FROM-CLAUDE.md` (§9: correcciones tras `MP01-REVISION-CODEX.md`) | `20261021120000_care_context_foundation` |
| MP02–03 bitácoras y alarma manual | `contracts/MP02-03-FROM-CLAUDE.md` | `20261021130000_care_records_manual_alarms` |
| MP04–05 criterios, motor, seguimiento y semáforo | `contracts/MP04-05-FROM-CLAUDE.md` | `20261021140000_care_alarm_criteria` |
| MP05b administración por el gestor | `contracts/MP05b-FROM-CLAUDE.md` | `20261021150000_care_administration` |
| MP06 recorrido de navegador y accesibilidad | este documento, §MP06 | — |

## MP06 — Recorrido real en navegador

`apps/api/test/care-browser.real.test.ts`, fuera de la baseline. Se omite y lo dice salvo con `CARE_BROWSER_WEB_URL`. Usa:
- la API real (AppModule con CORS como `main.ts`) sobre la base aislada;
- la web en desarrollo (`next dev` en el puerto 3100, apuntando a la API de prueba);
- Chromium con Playwright y axe-core;
- sesiones humanas sembradas, sin proveedor de identidad.

El escenario es ficticio: organización, gestor, contexto, cuidadora con relación, visitador con asignación y competencia, y revisora administradora del Hospital con competencia.

Resultado (run-id `mp06-055-browser1`): **5/5**.
1. **Visitador** (`/profesional`): valida un dato sí/no y un criterio (EQ «Sí», 1 vez en 1 hora, amarilla) desde los formularios, sin valores sugeridos.
2. **Cuidadora** (`/cuidador`): registra «Sí». El aviso confirma que se cumplió el criterio y se generó una alarma; pide revisión y ve el texto de recepción aprobado; la solicitud aparece «Pendiente de clasificación».
3. **Hospital** (`/hospital` › «Semáforo de alarmas»): la cola de revisión muestra «Semáforo: Amarillo…» en palabras; abre el espacio e inicia la revisión.
4. **Paciente** (`/paciente`): ve su espacio y no ve el gestor de criterios.
5. **axe** sobre los cuatro espacios de cuidado: **0 violaciones serias o críticas**.

Hallazgo de UX: el campo de ocurrencia tiene precisión de minuto. Un registro hecho «ahora», en el mismo minuto en que se activó un criterio, no cuenta para ese criterio, porque la activación es prospectiva (D04.3). La prueba espera, por condición, al minuto siguiente. Codex y el PO deben decidir si el campo debe precisar segundos.

## Verificación global final

| Prueba | Resultado |
|---|---|
| `tsc` shared/api/web (mismo argv que la etapa `typecheck`) | exit 0 |
| eslint de todo lo tocado | exit 0 |
| `npm run build:api` | exit 0 |
| Batería PostgreSQL `mp05b-055-dbsweep2`: provision → 28 etapas DB → openapi → cleanup | **709 pruebas, 0 fallos, 0 omitidas** |
| Web `vitest run` | 1877/1878; la única falla es la previa de `branding.test.tsx` |
| API `vitest` sin DB | todo pasa salvo la falla previa de `human-auth.config.test.ts` |
| Runner, catálogo y script (`node --test`) | 45/45 y 4/4 |
| Recorrido de navegador con axe | 5/5; 0 serias/críticas |
| secretos / SDD estricta | OK / 0 errores, 0 avisos |

Corrección de proceso: durante MP02–MP04 varios «0 errores de tipos» procedían de filtrar salida coloreada con un patrón que no coincidía. Al compilar aparecieron 8 errores reales. Se corrigieron y desde entonces todo se verifica por código de salida. Las entregas afectadas lo dicen expresamente.

## Fallas previas corregidas y baseline completa (orden del PO «sigue con las 2 fallas previas»)

- `apps/api/src/human-auth/human-auth.config.test.ts`: la prueba esperaba la allowlist antigua `['/', '/acceso']`. La spec 049 (aprobada) fija exactamente `/, /acceso, /hospital, /municipality`. Se corrigió **la prueba**, no el código, y se añadieron casos hostiles para los dos destinos institucionales (barra final, `..`, mayúsculas, query, doble barra, URL externa). 18/18.
- `apps/web/src/features/municipality/{municipalityModuleLayouts.ts,MunicipalitySources.tsx}` escribían «Eloisa» a mano. Ahora usan `branding.platformDisplayName`, como exige la regla de marca centralizada, y el texto mostrado es idéntico. Web 1883/1883.
- **Baseline completa** `--stage all`, run-id `mp06-055-all`, runner sin cambios: **34/34 etapas en pass, 2643 pruebas aprobadas, 0 fallos**, y cleanup correcto. Es la primera ejecución verde de punta a punta de esta rama.

## Pendiente fuera del alcance de esta entrega

- Hallazgos para Codex:
  - la policy `access_password_recovery_tenant` se creó sin `TO` (aplica a PUBLIC);
  - el atributo de solo lectura de Windows en 349 archivos parece un artefacto de la copia;
  - el límite de abuso de las escrituras de cuidado reutiliza el de la superficie humana (20 por ventana por IP).
- No hay revocación de espacios ni de gestores desde la interfaz, ni worker, WhatsApp, Elí o escalamiento por reloj (D07). Tampoco hay catálogos clínicos reales: todo es ficticio y validado por el profesional.
