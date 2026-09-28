# Investigación 034 — Liquidaciones demo de Cuidador y Visitador

## Hallazgos

- Existe una ruta de Visitador/Profesional en `/profesional`, pero no una ruta
  portal para Cuidador: solo tiene flujo de inscripción en `/inscripcion`.
- El portal Profesional tiene pestañas visuales y permite añadir una pestaña
  local sin alterar el bloque actual de visitas.
- Finanzas y pagos son sensibles y requieren separación de datos clínicos,
  identidad autenticada, auditoría y controles de tenant para una versión
  real; nada de eso debe fingirse en la demostración.

## Decisión derivada

Se crea `/cuidador` exclusivamente como portal demo y una vista compartida
local para ambos roles. El nombre visible será «Mis pagos y liquidaciones», no
«wallet», para evitar comunicar custodia de saldo.
