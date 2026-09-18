# HOSPITAL-REPORTS-UX-01 — Compact sticky filters

- **Estado:** READY FOR CLAUDE
- **Tiempo máximo:** 15 minutos
- **Objetivo:** reducir drásticamente la altura de la barra superior de filtros de Hospital → Reportes y mantenerla visible al hacer scroll, sin alterar ninguna función, dato o métrica.

## Alcance exacto

1. Conservar exactamente los seis grupos funcionales actuales: `Periodo`, `Programa`, `Municipio / zona`, `Población prioritaria`, `EPS` y `Modalidad`.
2. Reordenarlos en una barra compacta de baja altura. En escritorio, priorizar una sola franja o el mínimo de filas técnicamente legible; etiquetas, campos y chips deben ocupar mucho menos espacio vertical que hoy.
3. Mantener `Población prioritaria` como los tres chips multiselección actuales, con el mismo `aria-pressed` y la misma semántica combinable, pero en formato compacto.
4. Mantener `Limpiar filtros`, las acciones existentes y su estado habilitado/deshabilitado; alinearlos compactamente sin cambiar controladores ni significado.
5. Mostrar `Filtros aplicados` como resumen discreto, legible y no dominante.
6. Hacer la barra `sticky` durante el scroll, con offset correcto bajo el encabezado/topbar efectivo de Hospital, fondo y z-index suficientes y sin cubrir tabs ni contenido.
7. Los tabs `Resumen`, `Población`, `Operación`, `Finanzas` y `Evidencias` deben quedar inmediatamente después de la barra, con mucho menos espacio superior consumido.
8. En móvil/tableta permitir wrap o desplazamiento horizontal controlado según convenga, sin recorte, solapamiento, pérdida de labels, foco o objetivos táctiles accesibles.

## Invariantes

- No cambiar `ReporteFiltros`, valores iniciales, opciones, `aplicarFiltros`, `limpiarFiltros`, `resumenDeFiltros`, audiencia, tabs, URL, métricas, snapshots, datos ni acciones.
- No backend, red, persistencia, nueva dependencia ni nueva arquitectura.
- No rediseñar el resto de Reportes ni tocar otra pantalla.
- No modificar fixtures, Reportes funcionales, Hospital shell, auth, Pacientes, Profesionales, Agenda, Visitas o `prototype-claude/**`.

## Allowlist exacta

- `apps/web/src/features/hospital/HospitalReportsPieces.tsx`
- `apps/web/src/features/hospital/hospitalReports.module.css`
- `apps/web/src/features/hospital/hospitalReportsVista.test.tsx`

## Pruebas focales

Ejecutar únicamente:

```text
npx vitest run --root apps/web src/features/hospital/hospitalReportsVista.test.tsx
npm run typecheck --workspace @merdn/web
npx eslint apps/web/src/features/hospital/HospitalReportsPieces.tsx apps/web/src/features/hospital/hospitalReportsVista.test.tsx
```

No ejecutar suites completas.

## Criterios de aceptación

1. Los seis filtros y sus valores/controladores permanecen idénticos en comportamiento.
2. La barra usa `position: sticky`, offset explícito y una capa que no tapa los tabs o el contenido.
3. La composición de escritorio es materialmente más baja y los tabs quedan inmediatamente debajo.
4. Chips prioritarios, resumen, limpiar y acciones permanecen visibles, operables o deshabilitados exactamente como antes.
5. Existe comportamiento responsive explícito para móvil/tableta sin overflow destructivo.
6. La prueba focal protege labels, controles, multiselección, limpieza, resumen, acciones, sticky/offset y composición compacta sin afirmar métricas nuevas.

## Evidencia de entrega

Claude debe devolver los tres archivos cambiados, descripción de las alturas/filas por breakpoint, comandos/resultados y confirmación de cero cambios de lógica/datos. Detenerse si necesita ampliar la allowlist.
