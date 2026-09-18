# HOSPITAL-VISUAL-RECOVERY-01-B — Professionals

- **Estado:** READY FOR CLAUDE
- **Tiempo máximo:** 15 minutos
- **Objetivo:** recuperar la composición reconocible del directorio original de Hospital → Profesionales, preservando exclusivamente los datos y contratos reales de CORE-02.

## Referencias vinculantes

1. Composición original: `prototype-claude/Eligeme-Hospital.dc.html`, bloque Profesionales (aprox. líneas 419–444).
2. Decisiones funcionales posteriores: `TASK-HOSPITAL-CORE-02` y `TASK-HOSPITAL-CORE-02-FINAL-CORRECTION`.
3. Implementación actual en `develop`: cliente, listado, panel de detalle, afiliación, estados y pruebas.
4. Decisión Product Owner: estructura visual original + funcionalidad real actual + decisiones posteriores aprobadas.

El prototipo es solo referencia de jerarquía, tarjetas, espaciado y composición; ninguno de sus valores es fuente factual.

## Alcance exacto

1. Mantener consulta real, filtros admitidos, búsqueda, paginación, cancelación de respuestas tardías, selección/detalle, foco y estados carga/vacío/401/403/503 actuales.
2. Recuperar un directorio de tarjetas visualmente reconocible: iniciales, nombre, profesión controlada y estado del **perfil** institucional, con jerarquía equivalente al original.
3. Mostrar afiliación real de forma compacta cuando la respuesta la incluya: tipo, estado y fechas declaradas; no presentarla como contrato, habilitación o relación laboral acreditada.
4. Mantener el panel de detalle y su estructura de agenda únicamente porque el endpoint actual sí devuelve `window` y `appointments`; cada cita visible debe proceder del DTO real.
5. Las ausencias deben ser limpias o usar copy neutral de producto: `Información no disponible` o `Sin información registrada`, según contexto.
6. Mantener responsive, teclado, labels, foco visible y retorno al disparador.

## Retirar/no mostrar

- Rating, calificación o estrellas, incluso como slot con valor “no disponible”.
- Zona/comuna, disponibilidad, turno, conflicto, estado `En visita`, `Disponible`, `Fuera de turno` o equivalentes no servidos.
- Número de pacientes, visitas de hoy, próxima cita como métricas de tarjeta/resumen y cualquier KPI del prototipo.
- Botón `Ver agenda del profesional`; la agenda real puede vivir dentro del detalle ya existente, sin prometer navegación/capacidad nueva.
- Nombres, cifras, citas o cualquier dato del prototipo.
- Copy visible con `CORE`, `backend`, `API`, `demo`, `prototipo` o lenguaje técnico.

## Invariantes

- `ProfessionalProfile`, `ProfessionalAffiliation`, sesión institucional, cliente y API actuales permanecen como única fuente.
- Cero fixture o fallback ante error/vacío/denegación.
- No cambiar DTO, serialización, endpoints, permisos, servidor, filtros, paginación o lógica de red.
- No tocar Agenda, Reportes, Pacientes, Visitas, shell/auth/branding, backend, migraciones o `prototype-claude/**`.
- No dependencias, Task adicional, commit o push.

## Allowlist exacta

- `apps/web/src/features/hospital/HospitalProfessionals.tsx`
- `apps/web/src/features/hospital/ProfessionalDetailPanel.tsx`
- `apps/web/src/features/hospital/hospitalProfessionalsConfig.ts`
- `apps/web/src/features/hospital/hospitalProfessionals.module.css`
- `apps/web/src/features/hospital/hospitalProfessionals.test.tsx`

`ProfessionalEngagementPanel.tsx`, `hospitalProfessionalsClient.ts` y cualquier backend son solo lectura.

## Pruebas focales

Ejecutar únicamente:

```text
npx vitest run --root apps/web src/features/hospital/hospitalProfessionals.test.tsx src/features/hospital/hospitalProfessionalsClient.test.ts
npm run typecheck --workspace @merdn/web
npx eslint apps/web/src/features/hospital/HospitalProfessionals.tsx apps/web/src/features/hospital/ProfessionalDetailPanel.tsx apps/web/src/features/hospital/hospitalProfessionalsConfig.ts apps/web/src/features/hospital/hospitalProfessionals.test.tsx
```

No ejecutar suites completas.

## Criterios de aceptación

1. El directorio recupera tarjetas y jerarquía original con datos exclusivamente servidos.
2. Perfil y afiliación reales permanecen; cliente, filtros, paginación, errores y permisos no cambian.
3. La agenda del detalle, si se muestra, contiene solo citas del DTO real y no añade `Ver agenda del profesional`.
4. Rating, zona, disponibilidad, conflictos y métricas prohibidas no aparecen, ni siquiera como placeholders técnicos.
5. Ningún estado visible usa `CORE`, `backend`, `API`, `demo` o `prototipo`.
6. Pruebas focales, typecheck y lint del alcance pasan.

## Evidencia de entrega

Claude debe devolver archivos cambiados, mapa campo visible → propiedad DTO, comandos/resultados, prueba de ausencia de fixtures/fallback y términos prohibidos, y cualquier bloqueo real. Detenerse si necesita ampliar la allowlist o modificar contratos.
