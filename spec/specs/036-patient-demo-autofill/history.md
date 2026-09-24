# Historial 036 — Autocarga de pacientes demo

## 2026-09-23 — Decisión y consentimiento de Product Owner

La Product Owner solicitó avanzar de forma gradual: conservar el formulario de
inscripción existente y proporcionar tres pacientes totalmente ficticios que
puedan cargarse para demostraciones repetidas. Se excluyen contraseñas, cuentas
reales, datos reales y envío automático.

## 2026-09-23 — Implementación verificada

Se añadieron tres fixtures locales tipados, una acción de autocarga en memoria y
los botones visibles en Datos personales. Las seis pruebas de fixtures/interfaz,
TypeScript y el build web finalizaron correctamente. La imagen web de Docker se
reconstruyó y el contenedor quedó saludable.
