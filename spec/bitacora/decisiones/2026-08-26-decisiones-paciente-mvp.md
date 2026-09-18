# Decisión — Cierre de las decisiones abiertas del Paciente MVP

- **Fecha:** 2026-08-26
- **Decide:** Product Owner
- **Tipo:** decisiones de **producto**
- **Spec afectada:** `spec/specs/021-paciente-mvp-operativo/` (§17.B y §20)
- **Decisión previa:** `2026-08-26-alcance-paciente-mvp.md`

## Contexto

Al redactar la spec 021 aparecieron **nueve decisiones de producto abiertas** y
un punto de alcance del hito. Se marcaron para el Product Owner en vez de
resolverse por inferencia (`CLAUDE.md` §4 y §9). Este registro las cierra.

## Qué se decidió

### 1. Sesión canónica

Se usa la **sesión humana OIDC** como autenticación oficial del Paciente. La
**cookie de autoinscripción NO será la sesión permanente del portal**.

### 2. Inscripción → Paciente

Para el MVP del 2 de septiembre **no se construye autorregistro nuevo de
identidad**. Las identidades Paciente necesarias para pruebas y piloto se
aprovisionan mediante el **mecanismo administrativo seguro existente**. La
automatización posterior queda **fuera** de este MVP.

### 3. Ruta

Se conserva **`/`**. **No** se crea `/paciente` ahora. La experiencia mostrada en
`/` debe depender del **contexto y la sesión** correspondientes **sin introducir
una migración de return targets**.

### 4. Auditoría

El acceso propio del Paciente **debe quedar auditado**. La solución técnica
exacta la define **Codex / arquitectura**. Si requiere una migración **aditiva
mínima y segura** de `AuditEventType`, debe quedar **explícita en la spec**.
**No se elimina la auditoría para ahorrar tiempo.**

### 5. Resumen del Paciente

Solo información mínima necesaria: **nombre o iniciales** y **contexto básico de
orientación**.

**No** se muestran por defecto: documento, territorio, diagnósticos, información
clínica, EPS ni otros datos sensibles innecesarios.

### 6. Citas y visitas

**Solo las propias del Paciente.** Para el MVP: **próximas citas propias** y
**visitas propias recientes**, con **fecha y hora**, **modalidad**, **estado** y
datos mínimos necesarios. **No** se muestran identificadores técnicos ni
información de terceros.

### 7. Controles demo fuera del MVP

Se **ocultan** de la experiencia operativa: ayuda urgente, bitácora clínica,
pagos, mensajes, cuidador, consulta virtual, historia clínica y cualquier otra
función demostrativa fuera del alcance.

**No se borra su código**, salvo que una implementación futura lo requiera y esté
autorizada.

### 8. Cliente de sesión

La extracción o reutilización técnica del cliente de sesión humana hoy alojado
bajo Hospital **no es decisión de producto**. La resuelven **Codex y el agente
09** dentro de la arquitectura existente y con **mínimo cambio**.

### 9. Dependencias

Por defecto: **ninguna dependencia nueva**. Si alguna resultara verdaderamente
imprescindible: **STOP y justificar antes**.

### 10. Definición de «Paciente MVP operativo»

El Paciente **no** se declara operativo hasta tener, como mínimo: OIDC humano
legítimo; recuperación de sesión; logout real y revocable; resumen básico; citas
propias; visitas propias; self-scope; tenant/RLS; auditoría; `loading`; `empty`;
`error`; `retry`; sesión expirada; pruebas API/DB/RLS; y validación
runtime/navegador cuando exista navegador controlable.

**Todo lo demás queda después del 2 de septiembre.**

## Qué NO decide

- **No aprueba** la spec 021: su `Estado / Status` sigue en `Pendiente`.
- **No registra** el consentimiento SDD. Ese acto sigue pendiente y corresponde
  al Product Owner (`CLAUDE.md` §14.4).
- **No abre** la compuerta y **no** autoriza escribir código.

## Qué queda pendiente tras este cierre

Cuatro puntos, todos acotados y ninguno bloqueante de la totalidad:

**Concreciones de producto** (`spec.md` §17.C):

1. **Qué muestra `/` justo después de inscribirse.** La decisión 1 retira a la
   cookie de inscripción el papel de sesión del portal, y la 2 descarta el
   autorregistro: una persona recién inscrita no obtiene sesión de Paciente en
   ese acto. Falta decir qué ve entonces. *Recomendación de Claude Code, marcada
   como recomendación:* que la cookie de inscripción sirva solo para la
   confirmación de la inscripción —su función original—, y que el acceso de
   Paciente se ofrezca como entrada autenticada aparte. Bloquea solo la
   conmutación de fase.
2. **Lista cerrada de campos del «contexto básico de orientación»** del resumen.
   La decisión 5 fija con precisión lo prohibido, pero no enumera lo incluido, y
   «orientación» admite lecturas que llegarían a dato sensible. Bloquea solo la
   proyección de resumen.

**Delegados a Codex** (`spec.md` §17.D):

3. **Forma técnica de la auditoría** (decisión 4). Límite duro: aditiva, mínima,
   segura y explícita en la spec.
4. **Ubicación del cliente de sesión humana** (decisión 8). Límite duro:
   arquitectura existente y mínimo cambio.

## Consecuencias registradas el mismo día

- Se actualizó la documentación de la spec 021 —`spec.md`, `plan.md`,
  `tasks.md`, `research.md`, `history.md`—, `spec/specs/INDEX.md` y
  `spec/bitacora/global/PROJECT_LOG.md`.
- Se retiró `apps/web/src/app/paciente/page.tsx` de la allowlist, por la
  decisión 3.
- Se añadió a la spec la §20 con los dieciséis elementos de la definición de
  terminación.
- **Cero código, cero dependencias, cero cambios de esquema, cero migraciones,
  cero commits.**
