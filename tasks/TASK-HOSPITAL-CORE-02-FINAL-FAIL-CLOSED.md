# TASK-HOSPITAL-CORE-02 — Final fail-closed correction

## 1. Objetivo único

Eliminar el código predeterminado de `HOSPITAL_SCHEDULER` y exigir que su identidad solo se aprovisione cuando estén presentes y sean válidas, de forma separada:

- `MERDN_HOSPITAL_SCHEDULER_CODE`
- `MERDN_HOSPITAL_SCHEDULER_SECRET`

La ausencia, valor vacío o invalidez de cualquiera debe omitir exclusivamente la identidad `HOSPITAL_SCHEDULER`. No debe existir fallback, código derivado ni valor incorporado en fuente.

No cambiar ninguna otra funcionalidad de CORE-02.

## 2. Allowlist cerrada

Claude puede modificar exactamente:

1. `apps/api/src/institutional-auth/institutional-auth.contract.ts`
2. `apps/api/src/institutional-auth/institutional-auth.config.ts`
3. `apps/api/src/institutional-auth/institutional-auth.unit.test.ts`

Lectura y ejecución de pruebas relacionadas están permitidas. Si la corrección requiere cualquier otro archivo: **STOP**.

## 3. Cambio exacto

### 3.1 Contrato

En `institutional-auth.contract.ts`:

- eliminar `HOSPITAL_SCHEDULER_IDENTITY_CODE` y su comentario de “código por defecto”;
- conservar sin cambios `INSTITUTIONAL_ENV.hospitalSchedulerCode = "MERDN_HOSPITAL_SCHEDULER_CODE"`;
- conservar sin cambios `INSTITUTIONAL_ENV.hospitalSchedulerSecret = "MERDN_HOSPITAL_SCHEDULER_SECRET"`;
- conservar los códigos predeterminados históricos de `MUNICIPAL_VIEWER` y `HOSPITAL_PATIENT_VIEWER`.

No sustituir la constante eliminada por otro literal, derivación del rol o fallback equivalente.

### 3.2 Configuración

En `institutional-auth.config.ts`:

1. Eliminar el import de `HOSPITAL_SCHEDULER_IDENTITY_CODE`.
2. Representar explícitamente que una identidad configurable puede tener código histórico predeterminado o requerir código configurado. Una solución mínima admisible es `defaultCode?: string` o `defaultCode: string | null`.
3. Mantener:
   - `MUNICIPAL_VIEWER` con su comportamiento anterior;
   - `HOSPITAL_PATIENT_VIEWER` con su comportamiento anterior.
4. Definir `HOSPITAL_SCHEDULER` sin `defaultCode`.
5. Para Scheduler, leer `MERDN_HOSPITAL_SCHEDULER_CODE` y validar el patrón institucional existente.
6. Si el código Scheduler:
   - no existe;
   - contiene solo espacios;
   - no cumple `INSTITUTIONAL_IDENTITY_CODE_PATTERN`;
   entonces agregar una entrada `skipped` para `HOSPITAL_SCHEDULER` y no agregar identidad a `provisioning.identities`.
7. Si el secreto Scheduler:
   - no existe;
   - contiene solo espacios;
   - es más corto que `INSTITUTIONAL_SECRET_MIN_LENGTH`;
   entonces agregar una entrada `skipped` para `HOSPITAL_SCHEDULER` y no agregar identidad.
8. Scheduler se aprovisiona únicamente cuando código y secreto son válidos en la misma carga de configuración.
9. El motivo `skipped` puede nombrar la variable ausente/inválida y la superficie, pero nunca incluir el código recibido, secreto, longitud exacta del secreto ni otro valor sensible.
10. La validación de colisión de códigos entre roles permanece intacta y se ejecuta solo después de obtener un código Scheduler válido.

La ausencia de Scheduler no debe impedir cargar la API ni afectar otras identidades válidas: “fail-closed” significa que esa identidad no se aprovisiona y sus endpoints no autentican, siguiendo el patrón actual.

### 3.3 Pruebas unitarias

En `institutional-auth.unit.test.ts`, retirar imports y expectativas del código Scheduler predeterminado y cubrir como mínimo:

1. solo `MERDN_HOSPITAL_SCHEDULER_SECRET` válido → Scheduler omitido;
2. solo `MERDN_HOSPITAL_SCHEDULER_CODE` válido → Scheduler omitido;
3. ambos válidos → se aprovisiona exactamente `HOSPITAL_SCHEDULER` con el código configurado;
4. secreto válido + código vacío/espacios → Scheduler omitido;
5. secreto válido + código malformado → Scheduler omitido, sin fallback;
6. código válido + secreto vacío/espacios → Scheduler omitido;
7. código válido + secreto demasiado corto → Scheduler omitido;
8. variables válidas de Scheduler no aprovisionan otros roles;
9. configurar Hospital Patient Viewer sin ambas variables Scheduler no habilita Scheduler;
10. combinación de Viewer y Scheduler válidos mantiene roles y códigos separados;
11. colisión explícita de códigos válidos conserva la denegación existente;
12. los motivos `skipped` no contienen el código inválido recibido ni el secreto de prueba.

Actualizar cualquier prueba existente que hoy espera que “solo SECRET” aprovisione Scheduler: esa expectativa es el defecto y debe invertirse.

## 4. Pruebas focales requeridas

Ejecutar únicamente:

```text
apps/api/src/institutional-auth/institutional-auth.unit.test.ts
apps/api/src/institutional-auth/hospital-scheduler.guard.test.ts
```

Después ejecutar:

```text
npm --workspace apps/api run typecheck
```

Y verificar estáticamente:

```text
rg "HOSPITAL_SCHEDULER_IDENTITY_CODE|hospital-scheduler"
```

El resultado no debe encontrar un default de identidad Scheduler en código de producción. Un literal dentro de un caso de prueba explícito solo es admisible si representa un valor configurado por el test y no un fallback.

No ejecutar suites completas, pruebas RLS, benchmarking ni pruebas de rendimiento.

## 5. Criterios de aceptación

1. No existe constante ni literal productivo que actúe como código Scheduler predeterminado.
2. Falta de CODE con SECRET válido no aprovisiona Scheduler.
3. Falta de SECRET con CODE válido no aprovisiona Scheduler.
4. Valor vacío o inválido de cualquiera no aprovisiona Scheduler.
5. Solo ambos valores válidos aprovisionan Scheduler con el código exacto configurado.
6. No se registra ni devuelve ningún valor sensible.
7. Municipality y Hospital Patient Viewer conservan exactamente su comportamiento existente.
8. Colisiones de códigos continúan cerrándose de forma segura.
9. Pruebas focales y API typecheck pasan.
10. Solo los tres archivos del allowlist fueron modificados por esta corrección.

## 6. STOP CONDITIONS

Claude debe detenerse si:

- necesita modificar cualquier archivo fuera del §2;
- necesita cambiar sesión, cookie, guards, controller, servicio, API, Prisma, migración, frontend, CORS o CSRF;
- necesita cambiar o eliminar defaults de `MUNICIPAL_VIEWER` o `HOSPITAL_PATIENT_VIEWER`;
- propone un fallback, literal, derivación desde el rol o reutilización de otro código para Scheduler;
- necesita introducir una variable de entorno adicional;
- una prueba revela un defecto ajeno a este aprovisionamiento;
- no puede mantener mensajes sin valores sensibles;
- falla el typecheck o una prueba focal y la corrección exige ampliar alcance.

## 7. Handoff requerido

Claude debe entregar:

1. diff de los tres archivos autorizados;
2. matriz de CODE/SECRET: ausente, vacío, inválido y válido;
3. resultados exactos de las dos pruebas focales y typecheck;
4. resultado de la búsqueda de defaults Scheduler;
5. confirmación de que no cambió otros roles ni archivos;
6. RLS continúa `UNVERIFIED` y no fue investigado.

---

CORE-02 FINAL CORRECTION: READY

CLAUDE ACTION REQUIRED: YES

CLAUDE PACKET: `tasks/TASK-HOSPITAL-CORE-02-FINAL-FAIL-CLOSED.md`
