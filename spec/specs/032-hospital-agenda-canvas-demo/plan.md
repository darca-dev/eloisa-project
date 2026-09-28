# Plan 032 — Agenda y citas: canvas demo local

1. Modelar datos ficticios deterministas para solicitudes, calendario, conteos
   y estados visuales.
2. Crear una presentación de solo lectura con los tokens Hospital existentes.
3. Montarla únicamente con `modoDemoLocal` desde el shell.
4. Probar conteos, no-mutación y separación de la Agenda real; validar SDD y
   compilar.

## Riesgos y dependencia

Riesgo de confundir la muestra con agenda operacional; se mitiga con componente
separado, procedencia explícita y ningún control persistente. Requiere
consentimiento SDD explícito de la Product Owner.
