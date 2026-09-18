# Tareas 018 - Correcciones B1 y B2 de Visitador MP02

> **Prospectivo.** `[ ]` = pendiente. **Ninguna casilla puede marcarse hasta que
> la spec esté aprobada, el consentimiento registrado y resuelta la decisión de
> rama.** Nada de este archivo autoriza commit, merge, push ni despliegue
> (`CLAUDE.md` §12).

## Fase 0 — Habilitación (actos del Product Owner)

- [ ] Aprobar esta spec en `spec.md`: poner el valor `Aprobado` en la línea
      «Estado / Status», más fecha real, aprobador y evidencia. Dejar los
      marcadores `YYYY-MM-DD` o `Nombre o rol` hace fallar el gate
- [ ] Registrar el consentimiento por spec:
      `./spec/scripts/confirm-user-consent.sh --spec 018-correcciones-visitador-mp02 "User approved implementation for spec 018-correcciones-visitador-mp02"`
- [ ] Decidir dónde se implementa, dado que los dos archivos permitidos no
      existen en `develop` (STOP CONDITION abierta en `spec.md`)
- [ ] Verificar que la compuerta abre solo para esta spec:
      `./spec/scripts/check-sdd-gate.sh .`

## Fase 1 — B1, fail-closed de `visit`

- [ ] Distinguir `visit` **ausente** de `visit: null` explícito en
      `normalizarVisita`
      (`apps/web/src/features/visitador/visitadorWorklistClient.ts:281-284`)
- [ ] `visit: null` explícito sigue produciendo `visit: null` en la fila
      normalizada, sin cambio de comportamiento
- [ ] `visit` ausente invalida la respuesta completa, por el mismo camino que una
      forma inválida
- [ ] `visit` mal formado sigue invalidando la respuesta completa (regresión)
- [ ] La respuesta invalidada se descarta entera: ni fila omitida, ni lista
      parcial, ni repliegue a datos demostrativos

## Fase 2 — B2, validación de ventana

- [ ] Exigir igualdad literal entre la ventana solicitada y `window` de la
      respuesta, en `from` y en `to`
      (`normalizarWorklist:356-380`, llamada en `:468`)
- [ ] Una discrepancia invalida la respuesta con el mismo desenlace seguro
- [ ] Ventana invertida rechazada antes de la red: **ya implementado**
      (`esVentanaValida:240`), se protege contra regresión
- [ ] Ventana mayor de 31 días rechazada antes de la red, con 31 inclusive
      aceptada: **ya implementado**, se protege contra regresión
- [ ] No se añade tolerancia, normalización ni reintento con otra ventana

## Fase 3 — Pruebas

- [ ] `visit: null` explícito produce fila conservada
- [ ] `visit` **ausente** invalida la respuesta completa — prueba que hoy no
      existe y que es el núcleo de B1
- [ ] Los once cuerpos inválidos que hoy ya se rechazan siguen rechazándose
- [ ] Ventana invertida rechazada sin llamada de red
- [ ] Ventana de 32 días rechazada sin llamada de red; ventana de 31 días
      aceptada
- [ ] Ventana devuelta distinta en `from`: invalida
- [ ] Ventana devuelta distinta en `to`: invalida
- [ ] Ventana devuelta distinta en ambos: invalida
- [ ] Ventana devuelta idéntica: la respuesta se acepta y el resultado es el de
      hoy

## Fase 4 — Verificación y handoff

- [ ] `npx vitest run --root apps/web src/features/visitador/visitadorWorklistClient.test.ts src/features/visitador/visitadorExperience.test.tsx`
      — las 78 existentes más las nuevas, con salida reportada
- [ ] `npm run typecheck --workspace @merdn/web`
- [ ] `npx eslint apps/web/src/features/visitador/visitadorWorklistClient.ts apps/web/src/features/visitador/visitadorWorklistClient.test.ts`
- [ ] `git diff --check`
- [ ] `git status --short` — el diff toca exactamente dos archivos
- [ ] `./spec/scripts/check-sdd-gate.sh .` y
      `./spec/scripts/validate-sdd.sh . --strict`
- [ ] Handoff de `CLAUDE.md` §11 en `spec/bitacora/handoffs/`, con la salida
      exacta de cada comando y la distinción entre verificado y no verificado
- [ ] Anotar en la spec 017 que B1 y B2 quedaron cerradas y que B3, B4 y B5
      siguen abiertas

## Fuera de alcance — NO son tareas de esta spec

> Ninguna de estas líneas puede ejecutarse bajo esta spec. Hacerlo es
> desbordamiento de alcance y una STOP CONDITION (`CLAUDE.md` §9.10).

- [ ] B3 · pruebas de DOM e interacción real
- [ ] B4 · foco y accesibilidad
- [ ] B5 · verificación de navegador, ejecución y visual
- [ ] Dependencia de entorno DOM y ampliación de allowlist
- [ ] Integración de `wip/visitador-mp02-20260825` en `develop`
- [ ] Aprobación de la spec 017
- [ ] Hardening de la spec 017: auditoría de lectura, paginación, límite de tasa,
      zona institucional, desambiguación de `visit: null` en el servidor,
      unificación de la condición de autorización duplicada
- [ ] MP03 y cualquier transición profesional
- [ ] Cualquier cambio de diseño, texto de producto o dirección visual
