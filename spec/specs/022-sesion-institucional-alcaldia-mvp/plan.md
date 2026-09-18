# Plan 022 - Sesión institucional Alcaldía MVP

## Resumen

Implementación frontend mínima en dos micro-paquetes materiales de hasta 15 minutos. Se
reutiliza la superficie institucional existente; no hay backend, migración,
dependencia ni datos nuevos.

## Contexto técnico

- `/municipality` monta hoy `MunicipalityShell` sin recuperar sesión.
- Población y Territorio ya usan API real con cookie institucional.
- El cliente de sesión genérico está alojado bajo `features/hospital/`; se mueve
  a `features/auth/` y Hospital conserva una fachada compatible.
- Los guards, tenant/RLS, auditoría, supresión y logout ya existen en servidor.

## Reconciliación: no reconstruir

Ya existen y quedan fuera de cambios: shell visual, clientes y APIs de Población
y Territorio, guards `MUNICIPAL_VIEWER`, tenant/RLS, auditoría, supresión,
persistencia y estados propios de las consultas agregadas.

## Micro-paquetes Claude

1. **Packet A — Cliente compartido y fachada Hospital.** Mover sin alterar
   contrato; actualizar la prueba estructural cerrada y probar regresión. STOP
   si exige cambiar consumidores, backend o API.
2. **Packet B — Gate y estados de sesión municipal.** Añadir componente de entrada,
   recuperación, rol exacto, errores/retry y logout seguro; integrar en shell.
   STOP si se consulta un agregado antes de autorización.

## Validación consolidada Codex

Codex, no Claude, verifica después de ambos paquetes: pruebas focales,
regresiones Municipality/Hospital, Población/Territorio sin modificaciones,
typecheck, lint, diff-check, gate/strict y navegador real o bloqueo explícito.

## Dependencias

- Spec 005: shell visual municipal.
- Spec 008: agregados, sesión institucional, guards y seguridad.
- Spec 014: patrón probado de recuperación/entrada/cierre en una shell.
- Aprobación formal y consentimiento específico de spec 022.

## Hitos

- H1: transporte compartido sin regresión Hospital.
- H2: sesión `MUNICIPAL_VIEWER` gobierna el slice.
- H3: validación consolidada confirma Población/Territorio operativos, once
  vistas demo intactas y browser clasificado.

## Riesgos

- Duplicación o divergencia de lógica de sesión: mitigada con módulo compartido.
- Falso logout: solo respuestas confirmadas eliminan contexto.
- UI usada como autorización: mitigada manteniendo guards y pruebas negativas.
- Contenido demo interpretado como real: fuera del slice y siempre rotulado.
