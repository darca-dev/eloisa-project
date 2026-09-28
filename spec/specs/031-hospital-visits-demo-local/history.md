# Historial 031 — Visitas domiciliarias demo local

## 2026-09-21 — Propuesta creada

La Product Owner solicitó homologar visualmente Visitas domiciliarias y mostrar
cinco muestras. Se documentó una separación estricta entre la demo local de
solo lectura y la vista operativa existente. No se ha modificado código ni se
ha registrado consentimiento SDD.

## 2026-09-21 — Aprobación y consentimiento de Product Owner

La Product Owner aprobó explícitamente la implementación de la spec 031: cinco
visitas ficticias de solo lectura dentro del modo demo local. El consentimiento
se registra de forma trazable por spec antes de modificar código.

## 2026-09-21 — Implementación verificada

Se añadió una bandeja demo local separada que presenta cinco registros
deterministas, sin botones, red ni mutaciones. `HospitalShell` la monta solo con
`modoDemoLocal`; el flujo operativo existente permanece como alternativa fuera
de demo. Las pruebas focalizadas y el build web finalizaron correctamente.
