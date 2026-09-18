# @merdn/shared

Paquete de contratos y tipos técnicos compartidos del monorepo MERDN.

En TASK-001 el único consumidor es `apps/api`, que expone el contrato de salud.
`apps/web` lo consumirá cuando una Task Specification aprobada la conecte con la
API; TASK-001 no declara esa dependencia porque todavía no tiene uso real.

## Alcance (TASK-001)

Este paquete contiene **únicamente** contratos técnicos efectivamente compartidos.
En TASK-001 su contenido se limita al contrato del endpoint de salud
(`HEALTH_ROUTE`, `HEALTH_RESPONSE`, `HealthResponse`, `isHealthResponse`).

No contiene, y no debe contener sin una Task Specification aprobada:

- entidades, modelos o esquemas de dominio MERDN;
- reglas clínicas, institucionales, financieras o regulatorias;
- lógica de autorización, tenancy o auditoría;
- datos de ejemplo o demostrativos.

## Comandos

```bash
npm run build     --workspace @merdn/shared   # compila a dist/ (CommonJS + .d.ts)
npm run typecheck --workspace @merdn/shared   # TypeScript estricto sin emitir
npm run test      --workspace @merdn/shared   # pruebas unitarias (Vitest)
```

Los consumidores usan `dist/`. Por eso los scripts raíz (`npm run typecheck`,
`npm run test`, `npm run build`) compilan este paquete antes que las
aplicaciones.
