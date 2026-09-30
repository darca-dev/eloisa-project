# Plan 038 — Demo funcional de registros y aprobaciones ficticias

## Estado

Plan aprobado junto con `spec.md` y las decisiones OD-01 a OD-12 el 2026-09-24.
El Product Owner registró personalmente el consentimiento SDD el 2026-09-24.
El plan es ejecutable por paquetes; cada paquete debe volver a Codex para
auditoría antes de avanzar al siguiente.

## Estrategia

Construir una sola vertical demostrable en paquetes pequeños. El orden primero
recupera una línea base verificable, después añade persistencia y autorización,
y finalmente incorpora identidad, reset y evidencia. Ningún paquete puede
presentar una pantalla como funcional si su estado no persiste en el servidor.

## MP00 — Reconciliación y línea base verde

### Objetivo

Eliminar contradicciones antes de ampliar el producto.

### Trabajo

- Registrar la decisión de rama base.
- Resolver el estado documental de 027 y su relación con 035/038.
- Clasificar los siete fallos web contra su spec gobernante.
- Corregir regresiones o actualizar expectativas solo si el comportamiento
  nuevo ya fue aprobado.
- Separar las rutas protegidas de Hospital/Alcaldía del modo demo controlado por
  servidor y conectar `/acceso` a una única composición aprobada.
- Auditar los defectos de provisión atribuidos a 027 antes de reutilizar código.

### Salida verificable

- Build, typecheck y suite web verdes.
- SDD estricto y compuerta sin errores.
- Tabla fallo → causa → corrección → spec.
- Ninguna ruta normal recibe contexto ficticio sin modo demo autorizado.

## MP01 — Fundación de datos y auditoría

### Objetivo

Persistir solicitudes con estados, tenant, versionado y auditoría.

### Trabajo

- Añadir catálogos, capacidad revisora, `AccessRequest`, índices, FKs y RLS.
- Separar estado de aprobación de estado de provisión.
- Añadir eventos de auditoría y métodos transaccionales.
- Crear migración aditiva y rollback condicional.
- Probar dos tenants ficticios, grants y unicidad.

### Salida verificable

- Servicios y DB crean/leen solicitudes dentro del tenant.
- Cross-tenant, permiso incorrecto y duplicado quedan denegados.
- Ninguna API pública todavía.

## MP02 — Registro y acceso central

### Objetivo

Crear solicitudes persistentes desde una entrada central inequívoca.

### Trabajo

- Separar iniciar sesión, solicitar acceso y explorar demo.
- Exponer `POST /api/v1/access-requests` con validación, rate limit, origen,
  idempotencia y errores neutrales.
- Integrar Paciente, Cuidador y Personal de terreno sin otorgar permisos.
- Preparar identidad deshabilitada solo conforme a OD-03/OD-11.

### Salida verificable

- La solicitud persiste tras recarga y reinicio.
- Antes de aprobación no existe sesión utilizable.
- Los tres perfiles muestran procedencia demo.

## MP03 — Bandeja y decisiones del Hospital

### Objetivo

Reemplazar la bandeja en memoria por una superficie persistente y protegida.

### Trabajo

- Implementar capacidad/guard `HOSPITAL_ACCESS_REVIEWER`.
- Exponer listado paginado/minimizado y decisión versionada.
- Conectar la bandeja Hospital a la API.
- Implementar carga, vacío, error, conflicto y éxito.
- Auditar lecturas, decisiones y denegaciones.

### Salida verificable

- Hospital decide y conserva el resultado tras recarga.
- Otro tenant, Alcaldía, otros roles y la cuenta solicitante quedan denegados.

## MP04 — Provisión, identidad y acceso posterior

### Objetivo

Hacer que la aprobación produzca acceso verificable sin ampliar permisos de
negocio.

### Trabajo

- Implementar provisión OIDC con estado, reintento limitado e idempotencia.
- Persistir el identificador real devuelto por Keycloak.
- Paciente: habilitar self-scope del mismo sujeto.
- Cuidador: portada neutra hasta relación separada.
- Personal de terreno: perfil/afiliación según OD-06; sin asignación automática.
- Aplicar suspensión/revocación y política OD-04.

### Salida verificable

- Login falla antes, funciona después y se bloquea tras suspensión/revocación.
- Un fallo OIDC no deja estado `APPROVED` utilizable.
- Cuidador sin relación y profesional sin asignación no ven datos nominales.

## MP05 — Dataset, reset y runbook

### Objetivo

Preparar y recuperar la demo sin edición manual de base o Keycloak.

### Trabajo

- Dataset ficticio determinista con dos tenants de prueba.
- Reset idempotente limitado a base, realm y tenant demo.
- Scripts npm mínimos sin dependencias nuevas.
- Runbook con arranque, healthchecks, credenciales fuera del repo, recorrido,
  recuperación, reset y limpieza.

### Salida verificable

- Dos resets producen el mismo estado.
- El reset falla cerrado fuera del entorno permitido.
- Una persona nueva recupera el demo usando solo el runbook.

## MP06 — E2E, accesibilidad y evidencia

### Objetivo

Demostrar el flujo completo como lo recorrerá la clienta.

### Trabajo

- E2E independiente por perfil: registrar → revisar → decidir → autenticar.
- Casos negativos: duplicado, versión obsoleta, cross-tenant, rol incorrecto,
  fallo OIDC, cuidador sin relación, profesional sin asignación y revocación.
- Axe real, teclado y responsive de rutas afectadas.
- Ensayo cronometrado del guion y recuperación.

### Salida verificable

- Criterios de `spec.md` mapeados a evidencia.
- Build y suites completas verdes.
- Handoff de Claude Code listo para auditoría Codex.

## Dependencias y orden

`MP00 → MP01 → MP02 → MP03 → MP04 → MP05 → MP06`

- MP00 es hard gate para código nuevo.
- MP02 depende de migración/auditoría de MP01.
- MP04 depende de decisiones persistentes de MP03.
- MP05 espera el contrato estable de MP04.
- MP06 no comienza con pruebas base fallando.

## Hitos

1. **H1 Base confiable:** MP00.
2. **H2 Solicitud persistente:** MP01 y MP02.
3. **H3 Decisión hospitalaria:** MP03.
4. **H4 Acceso aprobado:** MP04.
5. **H5 Demo entregable:** MP05 y MP06.

## Riesgos y mitigación

- Alcance excesivo: revisión Codex después de cada MP.
- Aprobación confundida con relación/asignación: pruebas negativas obligatorias.
- Estados parciales OIDC/DB: estado explícito, idempotencia y compensación.
- Credencial institucional no atribuible: cerrar OD-10.
- Reset destructivo: ambiente, base, realm, tenant y confirmación.
- Desvío de specs previas: decisión registrada antes de código.

## Rollback operativo

- Cada MP debe poder revertirse sin reescribir historia Git ni migraciones.
- MP01 incluye rollback condicional y se niega con datos dependientes.
- MP02/MP03 se deshabilitan por configuración demo sin borrar solicitudes.
- MP04 deshabilita cuentas/sesiones creadas si se revierte integración.
- MP05 solo opera sobre recursos demo explícitos.
