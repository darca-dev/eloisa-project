# Decisión — Autorización de identidad OIDC efímera local para demo de Paciente

- **Fecha:** 2026-08-28
- **Decide y autoriza:** Product Owner
- **Tipo:** operación local sensible, temporal y reversible
- **Entorno:** desarrollo local, tenant ficticio únicamente
- **Punto de partida:** `develop` en `b136b2a`
- **No es:** una funcionalidad de producción, una modificación del producto ni
  una autorización de integración Git

## Autorización expresa del Product Owner

> AUTORIZO LA IDENTIDAD OIDC EFÍMERA LOCAL PARA EL DEMO DE PACIENTE,
> VINCULADA A LA PERSONA FICTICIA …b502, CON LINK, DEMOSTRACIÓN, UNLINK Y
> ELIMINACIÓN DEL USUARIO EFÍMERO EN KEYCLOAK, SIN MODIFICAR DATOS DEL
> PACIENTE NI DATOS OPERATIVOS.

Esta declaración satisface el consentimiento específico para ejecutar la
operación local acotada descrita aquí. No constituye consentimiento para una
spec de producto, no abre alcance sobre Visitador y no autoriza commit, push,
merge, release ni despliegue de la ejecución posterior.

## Recursos preexistentes autorizados

- Patient ficticio: `00000000-0000-4000-8000-00000000b505`.
- Person ficticia: `00000000-0000-4000-8000-00000000b502`.
- Tenant local ficticio: el tenant local al que pertenecen ambas filas, cuya
  coincidencia debe verificarse antes de ejecutar.

La operación no cambia la propiedad, el estado ni ningún campo de esas filas.

## Alcance permitido

1. Crear **un solo** usuario/subject OIDC ficticio y efímero en el Keycloak
   local.
2. Mantener el usuario fuera del realm JSON versionado y no modificar
   `infra/local-oidc/realm-merdn-local.json`.
3. Vincular el subject nuevo a la Person `…b502` exclusivamente mediante el
   mecanismo administrativo existente:
   `identity:provision --dry-run` y, solo con resultado esperado `APPLIED`,
   `identity:provision --apply`.
4. Usar esa credencial únicamente para demostrar inicio OIDC, sesión humana,
   contexto `PATIENT`, apertura de la interfaz y resumen del Paciente.
5. Permitir que citas esté vacío y que visitas refleje solamente información
   ficticia ya existente.
6. Al cerrar el demo, ejecutar `UNLINK` mediante `--dry-run` y después
   `--apply`, comprobar el estado `UNLINKED` y cero sesiones vivas, y eliminar
   de Keycloak exactamente el usuario efímero.
7. Conservar las filas históricas `UNLINKED` y los eventos de auditoría que el
   ciclo de identidad produce; no borrarlas manualmente.

## Precondiciones obligatorias

Antes de cualquier escritura, Claude Code debe verificar y reportar:

1. entorno local de desarrollo y datos exclusivamente ficticios;
2. `develop` en `b136b2a`, salvo nueva decisión expresa del Product Owner;
3. Patient `…b505` ACTIVE y perteneciente a Person `…b502` en el mismo tenant;
4. subject propuesto ausente tanto en Keycloak como en
   `external_auth_identity` para el tenant y emisor;
5. Person `…b502` existente y perteneciente al tenant local activo;
6. emisor exacto admitido por `MERDN_IDENTITY_PROVISIONING_ISSUERS`;
7. `MERDN_RUNTIME_ROLE=enforce` activo;
8. rol `merdn_runtime` sin `BYPASSRLS` y contexto de tenant establecido y
   verificado por la herramienta;
9. `persona.ficticia` y su vínculo actual registrados como línea base para
   demostrar que quedan intactos;
10. archivo de operación y contraseña temporal fuera del repositorio, sin
    imprimir secretos.

## Operaciones y mutaciones prohibidas

- Crear o modificar `Person`, `Patient`, `Appointment`, `HomeVisit`,
  `CareAssignment` u otra fila de negocio, operación o clínica.
- Modificar `persona.ficticia`, reutilizar su subject o revincular su cuenta.
- Ejecutar SQL directo para crear, mover o borrar vínculos de identidad.
- Desactivar RLS, cambiar `MERDN_RUNTIME_ROLE=enforce` o omitir el contexto de
  tenant.
- Usar almacenamiento del navegador, cookies inyectadas o identificadores del
  cliente como bypass de autenticación o self-scope.
- Modificar código, esquema, migraciones, fixtures, seeds, CORS, worktrees,
  staging, realm JSON versionado o archivos de producto.
- Crear datos reales, commit de la ejecución, push, merge, release o deploy.
- Iniciar trabajo de Visitador.

## Verificación obligatoria del demo

Claude Code debe devolver evidencia de:

1. login OIDC exitoso con la credencial efímera;
2. `GET /api/v1/human-auth/session` con `200`;
3. `GET /api/v1/me/contexts` con `PATIENT`;
4. interfaz Paciente abierta y resumen ficticio visible;
5. ausencia de manipulación del almacenamiento o bypass de autorización;
6. self-scope preservado y ningún otro Patient expuesto;
7. auditoría veraz de LINK, sesión y acceso Patient self-scope;
8. `persona.ficticia`, Patient `…b505` y Person `…b502` sin cambios;
9. cero filas de negocio creadas o actualizadas;
10. RLS y `MERDN_RUNTIME_ROLE=enforce` preservados;
11. cero cambios de código o archivos rastreados por la ejecución.

## Limpieza obligatoria

La ejecución no se considera cerrada hasta que Claude Code:

1. ejecute `UNLINK --dry-run` y obtenga el resultado esperado `APPLIED`;
2. ejecute `UNLINK --apply` y obtenga `APPLIED`;
3. verifique la identidad `UNLINKED` y cero sesiones humanas vivas;
4. elimine de Keycloak el usuario exacto creado para el demo;
5. verifique que el subject ya no existe en Keycloak;
6. preserve la cuenta, el vínculo histórico y la auditoría como evidencia;
7. repita la comprobación de inmutabilidad de Patient, Person,
   `persona.ficticia` y datos de negocio;
8. reporte cualquier residuo o desviación como bloqueo, no como cierre exitoso.

## Stop conditions

Claude Code debe detener la parte afectada, sin improvisar, si:

- cualquier precondición falla o no puede verificarse;
- el subject ya existe o el dry-run no devuelve el `APPLIED` esperado;
- Keycloak no conserva de forma verificable el subject exacto;
- la herramienta intenta alcanzar otra Person o tenant;
- RLS, el rol runtime o el contexto del tenant no pueden confirmarse;
- aparece cualquier dato real, cambio de negocio o necesidad de SQL directo;
- la demostración exige modificar código, CORS, worktree, staging o Git;
- `persona.ficticia`, Patient `…b505` o Person `…b502` difieren de la línea
  base;
- UNLINK, revocación de sesiones o eliminación del usuario no pueden
  completarse y verificarse.

## Efecto de gobernanza

Este registro es el artefacto de ejecución mínimo exigido por `CLAUDE.md` para
la operación local sensible. La operación no necesita una nueva spec de
funcionalidad porque no cambia producto, arquitectura, esquema ni código.

La autorización habilita únicamente crear el usuario efímero, ejecutar LINK,
realizar la demostración acotada, ejecutar UNLINK y eliminar ese usuario. Toda
otra mutación permanece denegada.
