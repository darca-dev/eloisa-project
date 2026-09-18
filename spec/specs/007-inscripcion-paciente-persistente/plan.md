# Plan 007 - Inscripción a paciente persistente

## Resumen

**Retrospectivo.** Tres commits: tarea, auditoría e implementación.

## Contexto técnico

Primer contacto del repositorio con PostgreSQL. Las decisiones que fijó aquí
—tenant en servidor, RLS desde el inicio, transacción única, auditoría,
fail-closed— se convirtieron en la base sobre la que se construyeron todas las
capacidades de datos posteriores (specs 008 a 017).

## Fases de implementación (ejecutadas)

1. Tarea MVP CORE-01 — `a5d8a49`.
2. Auditoría final — `efc4656`.
3. Implementación — `9c62f5d`: migraciones, módulos de API, cliente web y pruebas.

## Dependencias

- Spec 001: Prisma, PostgreSQL, Compose.
- Spec 002: la experiencia de inscripción que ahora envía a la API.

## Hitos

- H1: inscripción persistida en transacción única — fase 3.
- H2: RLS activa y probada — `core-01-hardening.db.test.ts`.

## Riesgos (vigentes)

- **La experiencia de paciente no consume la API.** `GET /api/v1/patients/me`
  existe pero `features/paciente` no lo usa; su bitácora sigue en memoria.
- **Tenant cacheado en memoria**: cambiarlo exige reinicio. Es coherente con la
  decisión de que sea configuración estable del despliegue, pero conviene tenerlo
  presente antes de cualquier trabajo multi-tenant dinámico, que hoy no está
  aprobado (`CLAUDE.md` §4).
