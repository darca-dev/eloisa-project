# HOSPITAL-VISUAL-RECOVERY-01-A — Pacientes

- **Estado:** READY FOR CLAUDE
- **Tiempo máximo:** 15 minutos
- **Objetivo:** recuperar en Hospital → Pacientes la composición reconocible de ficha/expediente e historial del diseño original, conservando íntegramente la consulta CORE-01 real y todas las decisiones de seguridad posteriores.

## Referencias vinculantes

1. Estructura original: `prototype-claude/Eligeme-Hospital.dc.html`, bloque Pacientes (aprox. líneas 297–359).
2. Implementación visual histórica: commit `2e1fe65`, `HospitalPatients.tsx`.
3. Contrato funcional y de datos: `TASK-HOSPITAL-CORE-01`, su corrección y la implementación actual en `develop`.
4. Decisión del Product Owner: **ORIGINAL VISUAL STRUCTURE + CURRENT REAL FUNCTIONALITY + LATER APPROVED PRODUCT DECISIONS**.

El prototipo y el commit histórico son referencias de composición, no fuentes de datos ni código a restaurar literalmente.

## Alcance exacto

1. Mantener listado, búsqueda, filtros permitidos, orden, paginación, analítica, selección/detalle, cancelación, reintento y estados 401/403/404/error actuales.
2. Reorganizar la presentación del paciente seleccionado con la jerarquía visual original:
   - cabecera de ficha con iniciales, nombre y resumen permitido;
   - cuadrícula rica de campos del expediente permitido;
   - bloque de historial/línea de tiempo visualmente reconocible.
3. Alimentar nombre, iniciales, documento enmascarado, edad/fecha de nacimiento, EPS, estado, prioridades declaradas, territorio y contacto **solo** desde `HospitalDetalleDto` real.
4. Mantener visible `Registros ELOISA` y la fecha/procedencia servida.
5. Donde el diseño original esperaba condiciones, semáforo clínico, atenciones, medicamentos, profesional, cuidador, programa u otros datos no servidos, mostrar un único estado neutral y accesible de capacidad no disponible. No crear filas de historial ni eventos vacíos que parezcan hechos.
6. Conservar los avisos de que ELOISA no reemplaza la historia clínica y que datos declarados no son diagnósticos/certificaciones.
7. Mantener responsive, teclado, foco del detalle y semántica de encabezados/listas.

## Prohibiciones

- No importar ni consultar `hospitalPopulationFixtures.ts`, `hospitalPacientesDemo` ni otro fixture factual.
- No fallback demo ante vacío, carga, error, 401, 403 o 404.
- No restaurar nombres, documentos, contactos, condiciones, eventos o fechas del prototipo.
- No semáforo/alerta clínica, color de riesgo ni regla clínica ficticia.
- No modificar cliente/API, contratos DTO, backend, schema, migraciones, shell, auth, branding, Agenda, Profesionales, Visitas, Reportes, H-FID-C o `prototype-claude/**`.
- No dependencias, Task adicional, commit o push.

## Allowlist exacta

- `apps/web/src/features/hospital/HospitalPatients.tsx`
- `apps/web/src/features/hospital/HospitalPatientsPieces.tsx`
- `apps/web/src/features/hospital/hospitalPatients.module.css`
- `apps/web/src/features/hospital/hospitalPatients.test.tsx`

## Pruebas focales

Ejecutar desde la raíz con el root/config correcto del workspace Web, únicamente:

```text
npx vitest run --root apps/web src/features/hospital/hospitalPatients.test.tsx src/features/hospital/hospitalPatientsClient.test.ts
npm run typecheck --workspace @merdn/web
npx eslint apps/web/src/features/hospital/HospitalPatients.tsx apps/web/src/features/hospital/HospitalPatientsPieces.tsx apps/web/src/features/hospital/hospitalPatients.test.tsx
```

No ejecutar suites completas.

## Criterios de aceptación

1. La ficha seleccionada recupera la jerarquía visual original sin perder ninguna operación real actual.
2. Todo dato factual visible procede del DTO real; la prueba demuestra ausencia de imports/fallback demo.
3. `Registros ELOISA` permanece visible.
4. Semáforo, condiciones e historial clínico ficticios no reaparecen; lo no modelado se distingue claramente de una ausencia real.
5. Vacío, carga, errores y denegaciones limpian datos nominales previos y nunca muestran el prototipo.
6. Las pruebas focales, typecheck Web y lint del alcance pasan.

## Evidencia de entrega

Claude debe devolver archivos cambiados, resumen de la reconciliación visual, origen de cada campo visible, comandos/resultados, confirmación de cero fixture/fallback y cualquier bloqueo real. Detenerse si cumplir exige ampliar la allowlist o cambiar contratos/datos.
