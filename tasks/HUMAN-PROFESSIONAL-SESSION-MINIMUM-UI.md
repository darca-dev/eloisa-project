# HUMAN PROFESSIONAL SESSION — Minimum UI Gate

## Identificación

- **Estado:** `READY FOR CLAUDE`
- **Tiempo máximo:** 15 minutos.
- **Objetivo:** permitir que Home Visits abra, detecte y cierre la sesión humana profesional usando exclusivamente human-auth existente.

No crear otro login, modificar Identity backend, tocar VISITS backend, rediseñar
Hospital, H-FID-C ni Reportes.

## Contratos existentes obligatorios

- Inicio OIDC: `GET /api/v1/human-auth/login?returnTo=/` mediante navegación
  normal del navegador, no mediante `fetch`.
- Estado: `GET /api/v1/human-auth/session` con `credentials: include` y
  `cache: no-store`.
- Logout: `POST /api/v1/human-auth/logout` con la misma cookie HttpOnly.
- La sesión usable exige que `contexts` contenga `PROFESSIONAL`.
- La cookie `merdn_human_session` nunca se lee, escribe ni copia desde JS.

El callback hoy retorna al destino aprobado `/`. Por eso el enlace OIDC se abre
en una pestaña nueva con `rel="noopener noreferrer"`; la pestaña Hospital
permanece intacta y ofrece `Comprobar sesión profesional` al regresar. No
inventar callback, mensaje cross-window, token ni almacenamiento local.

## Cliente mínimo

Crear `hospitalHumanSessionClient.ts` con:

- URL absoluta del login construida con `resolvePublicApiBaseUrl()` y
  `returnTo=/` exacto;
- `consultarSesionHumana()` que devuelve `activa-profesional`,
  `activa-sin-contexto`, `sin-sesion`, `cancelado` o `no-disponible`;
- `cerrarSesionHumana()` usando POST, con desenlaces seguros;
- DTO solo con `expiresAt`, `idleExpiresInSeconds`, `contexts`.

No aceptar tenant, persona, paciente, profesional, actor, subject o claims.

## Integración Home Visits

En `HospitalHomeVisits`:

1. cuando la consulta de la visita indique falta de sesión humana, mostrar
   `Abrir sesión profesional` como enlace OIDC en pestaña nueva;
2. mostrar `Comprobar sesión profesional` para consultar el contrato humano;
3. solo si el servidor devuelve contexto `PROFESSIONAL`, volver a consultar la
   visita; las acciones siguen dependiendo del `ok` del endpoint Visits;
4. contexto humano sin `PROFESSIONAL` no habilita acciones;
5. permitir `Cerrar sesión profesional`; tras éxito retirar acciones y volver
   al estado fail-closed;
6. nunca retirar, cerrar ni reutilizar la sesión institucional;
7. no mostrar IDs, códigos técnicos, expiraciones técnicas ni datos personales.

## Allowlist exacta

- nuevo `apps/web/src/features/hospital/hospitalHumanSessionClient.ts`;
- nuevo `apps/web/src/features/hospital/hospitalHumanSessionClient.test.ts`;
- `apps/web/src/features/hospital/HospitalHomeVisits.tsx`;
- `apps/web/src/features/hospital/hospitalOperaciones.test.tsx`;
- `apps/web/src/features/hospital/hospitalAlcance.test.ts` — añadir exactamente
  este sexto cliente autorizado y ajustar el conteo textual correspondiente.

No modificar Shell, Agenda, CSS, backend, configs demo, prototype ni Reportes.
Reutilizar controles/estilos existentes.

## Pruebas focales

```text
npx vitest run --root apps/web src/features/hospital/hospitalHumanSessionClient.test.ts src/features/hospital/hospitalOperaciones.test.tsx src/features/hospital/hospitalAlcance.test.ts
```

Cubrir: URL OIDC exacta y navegación sin fetch; cookie implícita; sesión con y
sin `PROFESSIONAL`; 401/503/red/aborto; logout; acciones ausentes hasta
autorización Visits; reconsulta tras comprobar; cierre retira acciones; ninguna
lectura/escritura de cookie o storage; cero IDs de autoridad enviados.

No ejecutar suites completas ni pruebas visuales.

## STOP

Detenerse si hace falta token en JS, password local, dev-login, header de
identidad, cambio de callback/backend o tratar sesión institucional como humana.

## Handoff

Claude devuelve cinco archivos, comando/resultado focal y confirma cero bypass,
cero backend, cero storage/cookie JS, cero Reportes/H-FID-C.

