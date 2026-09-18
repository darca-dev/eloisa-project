# Decisión — Autorización del demo local de Visitador Médico

- **Fecha:** 2026-08-28
- **Decide y autoriza:** Product Owner
- **Tipo:** operación local sensible, temporal, aislada y reversible
- **Entorno autorizado:** desarrollo local, con datos exclusivamente ficticios
- **Rama preservada de Visitador:** `feat/visitador-mp02-corrections`
- **Commit preservado verificado:** `048ba9409ef147b4afe92ffe7bed2eb62395e4ac`
- **Punto de registro:** `develop` en `bb8db9b`
- **No es:** implementación, aceptación funcional, autorización de integración Git,
  autorización de despliegue ni cambio permanente de arquitectura o seguridad

## Autorizaciones expresas del Product Owner

> AUTORIZO EL DEMO LOCAL DE VISITADOR MÉDICO EN UN WORKTREE SEPARADO EN
> PUERTO 3002, CON CORS LOCAL TEMPORAL Y UNA IDENTIDAD OIDC PROFESIONAL
> EFÍMERA, SIN MERGE A develop, SIN DATOS REALES Y CON LIMPIEZA POSTERIOR.

> AUTORIZO A CODEX A REGISTRAR Y HACER COMMIT DEL ARTEFACTO DE GOBERNANZA
> DEL DEMO LOCAL DE VISITADOR MÉDICO EN develop.

La segunda autorización cubre exclusivamente este archivo y su commit en
`develop`. Este acto no ejecuta la primera autorización ni delega en Codex la
implementación u operación del demo.

## Alcance autorizado para una ejecución posterior

La autorización operativa queda limitada a:

1. crear un worktree separado desde la rama preservada y sin modificarla;
2. servir la experiencia de Visitador Médico localmente en el puerto `3002`;
3. aplicar únicamente el cambio CORS local, temporal y mínimo necesario para
   admitir el origen exacto del demo;
4. crear una identidad OIDC profesional ficticia y efímera únicamente en el
   proveedor de identidad local;
5. usar esa identidad exclusivamente para demostrar el flujo local acotado de
   Visitador Médico;
6. recolectar evidencia verificable de ejecución y de limpieza; y
7. retirar al finalizar el worktree, el ajuste CORS temporal, la identidad OIDC
   efímera, sus sesiones y cualquier otro residuo creado exclusivamente para el
   demo.

La ejecución deberá preservar la historia y el estado local preexistente de
`develop`, incluido el demo de Paciente. La rama
`feat/visitador-mp02-corrections` debe permanecer en el commit verificado y no
recibir modificaciones, commits, merges ni rebases.

## Límites y operaciones prohibidas

- No hacer merge de Visitador a `develop` ni a ninguna otra rama.
- No modificar la rama preservada de Visitador ni su commit.
- No modificar código de producto como parte de esta autorización.
- No convertir el CORS temporal en configuración versionada o permanente.
- No crear identidades, sesiones ni datos en entornos distintos del local.
- No usar datos reales, personales, clínicos, institucionales o financieros.
- No reutilizar identidades reales ni credenciales persistentes.
- No alterar el demo local de Paciente ni su estado preexistente.
- No hacer commit de artefactos de ejecución, secretos o configuración efímera.
- No hacer push, pull request, release, despliegue ni operación sobre `main`.
- No presentar el demo como integración, funcionalidad aceptada o capacidad de
  producción.

## Precondiciones para la ejecución posterior

Antes de mutar el entorno local, el agente ejecutor deberá verificar y
reportar:

1. que opera fuera de `main` y que `develop` no será modificado por la
   ejecución;
2. que la rama preservada resuelve exactamente a
   `048ba9409ef147b4afe92ffe7bed2eb62395e4ac`;
3. que el worktree propuesto es nuevo, separado y deriva de ese commit sin
   mover la rama preservada;
4. que el puerto `3002`, el origen CORS exacto y los servicios locales
   involucrados están identificados;
5. que la identidad propuesta no existe y no corresponde a una persona real;
6. que todo dato visible o creado será ficticio;
7. que existe una línea base del estado Git, CORS, proveedor OIDC, sesiones y
   estado del demo de Paciente para comprobar la restauración; y
8. que existe un procedimiento de limpieza verificable antes de iniciar.

## Evidencia mínima de la ejecución posterior

El agente ejecutor deberá devolver, sin revelar secretos:

1. ruta y commit efectivo del worktree separado;
2. proceso local escuchando en `3002` y origen CORS temporal exacto;
3. identidad OIDC ficticia creada y alcance profesional aplicado;
4. autenticación y flujo de Visitador demostrado, con resultados y
   limitaciones observadas;
5. confirmación de que no se usaron datos reales;
6. diff y estado de ramas que demuestren que `develop`, `main` y la rama
   preservada no fueron modificadas; y
7. comprobaciones de limpieza descritas en la sección siguiente.

## Limpieza obligatoria

La operación no se considera cerrada hasta comprobar:

1. eliminación del worktree separado y de sus residuos temporales;
2. restauración de CORS a su línea base local;
3. cierre o reinicio controlado de los procesos afectados, según corresponda,
   y ausencia del servicio del demo en `3002`;
4. revocación de todas las sesiones de la identidad efímera;
5. eliminación de la identidad OIDC efímera y verificación de su ausencia;
6. ausencia de secretos, credenciales o datos sensibles en archivos y logs;
7. preservación exacta de la rama Visitador en el commit autorizado;
8. preservación de `develop`, `main` y del estado preexistente del demo de
   Paciente; y
9. reporte explícito de cualquier residuo o desviación pendiente.

## Stop conditions

La ejecución posterior debe detener la parte afectada, sin improvisar, si:

- la rama Visitador no resuelve al commit autorizado;
- la separación del worktree exige mover, modificar o integrar una rama;
- el puerto, CORS o proveedor OIDC no pueden limitarse al entorno local;
- aparece cualquier dato real o una identidad preexistente;
- el demo exige modificar código de producto o configuración versionada;
- no puede preservarse el estado local de `develop` o del demo de Paciente;
- la autenticación requiere eludir autorización, aislamiento institucional,
  auditoría o controles de seguridad; o
- la revocación, eliminación o limpieza no puede completarse y verificarse.

Una desviación o limpieza incompleta debe reportarse como bloqueo o incidente,
nunca como cierre exitoso.

## Efecto de gobernanza

Este registro autoriza una operación local posterior bajo límites verificables
y autoriza a Codex a registrar y hacer commit únicamente de este artefacto en
`develop`. No implementa el demo, no crea el worktree, no cambia CORS, no
reinicia la API, no crea ni provisiona identidades, no modifica Visitador ni
producto, no integra ramas y no despliega.

## Registros relacionados

- `2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md`
- `2026-08-28-autorizacion-demo-paciente-identidad-oidc-efimera.md`
