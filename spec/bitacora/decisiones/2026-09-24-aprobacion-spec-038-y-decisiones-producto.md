# Decisión — Aprobación de la spec 038 y de OD-01 a OD-12

## Date / Fecha

2026-09-24

## Context / Contexto

MERDN necesita convertirse en un demo local revisable y entregable con datos
ficticios. El repositorio contiene superficies visuales y capacidades parciales,
pero también contradicciones documentales, siete fallos en la línea base web y
un flujo de aprovisionamiento que no demuestra sesión completa, persistencia del
`sub` real ni recuperación segura ante fallos.

Codex preparó la spec `038-demo-funcional-accesos-ficticios` después de revisar
el repositorio y recibir análisis especializados de seguridad/datos y
arquitectura/pruebas. La sección 20 presentó doce decisiones con recomendación
explícita para cerrar arquitectura y comportamiento de producto.

Fuentes: `spec/specs/038-demo-funcional-accesos-ficticios/spec.md`,
`research.md` e instrucción explícita del Product Owner en la sesión del
2026-09-24.

## Decision / Decisión

El Product Owner aprobó formalmente la spec 038 y adoptó las recomendaciones
OD-01 a OD-12 como decisiones de producto.

Esto fija:

1. rama nueva desde `develop` e integración exclusiva de cambios demo aceptados;
2. creación de `Person` y solicitud al registrar, y `Patient` solo al aprobar;
3. datos mínimos ficticios, contraseña gestionada por Keycloak y persistencia
   del `sub` real;
4. revocación inmediata y denegación en la siguiente petición;
5. cuidador aprobado sin relación en una portada neutra y sin pacientes;
6. perfil y afiliación ficticia para profesional, sin asignación automática;
7. conservación predeterminada de auditoría en los resets;
8. aprobación de textos demo, aprobación y no-pago antes de implementar UI;
9. un tenant equivalente a un Hospital ficticio verificador en este alcance;
10. identidad revisora dedicada para el demo;
11. contraseña ficticia elegida en registro, enviada directamente al OIDC local
    y nunca persistida por MERDN;
12. sustitución del modo en memoria de 035 por 038, sin aprobación retroactiva
    de 027.

La aprobación y el consentimiento SDD son actos separados. El consentimiento
para 038 todavía no está registrado.

### Seguimiento del mismo día

El Product Owner registró personalmente el consentimiento SDD específico el
2026-09-24 a las 22:34:29 -0600. La afirmación anterior conserva el estado que
existía en el momento exacto de la decisión; este seguimiento registra el acto
posterior.

### Ejecución posterior de OD-01

Tras el `FAIL` de MP00 por haberse trabajado en la rama anterior, el Product
Owner autorizó explícitamente considerar aceptados los once commits demo entre
`develop` (`ad7a18c`) y `530a722`, crear
`feat/038-demo-funcional-accesos-ficticios` en el mismo HEAD y cambiar el
workspace. Codex ejecutó únicamente esa creación/cambio de rama; preservó los
cambios locales y no realizó commit, merge, rebase, cherry-pick, push, PR ni
despliegue.

## Alternatives considered / Alternativas consideradas

- Mantener estado en memoria o `localStorage`: descartado porque no demuestra
  persistencia, aislamiento, autorización ni auditoría.
- Crear relaciones de cuidador o asignaciones profesionales al aprobar:
  descartado porque ampliaría acceso a datos y capacidad clínica sin una
  decisión separada.
- Ejecutar el proveedor de identidad dentro de la transacción de PostgreSQL:
  descartado porque no existe atomicidad distribuida y puede dejar estado
  parcial sin recuperación explícita.
- Reutilizar directamente la implementación atribuida a 027: descartado hasta
  reconciliar su contradicción documental y corregir su provisión.

## Consequences / Consecuencias

- `spec.md`, `plan.md`, `tasks.md`, `history.md`, el contrato y `INDEX.md`
  reflejan la aprobación.
- T00.1 queda completada; las tareas de implementación continúan pendientes.
- Claude Code puede implementar únicamente después del consentimiento SDD
  específico y dentro de los archivos, límites y pruebas aprobados.
- La aprobación no autoriza commit, merge, push, pull request, release ni
  despliegue.

## When to revisit / Cuándo revisar esta decisión

Reabrir la decisión afectada si el demo requiere varios Hospitales dentro de un
tenant, identidades o datos reales, correo/SMS, pagos, reglas clínicas, un
proveedor OIDC externo, o un cambio de permisos, relación, asignación,
retención o límites institucionales.

## Related records / Registros relacionados

- `spec/specs/038-demo-funcional-accesos-ficticios/`
- `spec/specs/035-central-access-institutional-approval/`
- `spec/specs/027-portal-central-cuenta-paciente-persistente/`
- `spec/specs/037-local-oidc-recovery/`
