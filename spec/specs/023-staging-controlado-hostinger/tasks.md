# Tasks — Spec 023

## Paquete A

- [ ] Crear `compose.staging.yml` sin alterar `compose.yml` local.
- [ ] Mantener PostgreSQL, OIDC, API y web internos; publicar solo el proxy.
- [ ] Configurar borde HTTPS y redirección HTTP→HTTPS sin certificados reales.
- [ ] Añadir `.env.staging.example` con nombres/placeholders, nunca secretos.
- [ ] Documentar preflight, migración, salud, backup, restore, rollback y browser.
- [ ] Probar Compose config, secrets scan, lint y diff check.

## Paquete B

- [ ] Implementar preflight fail-closed sin imprimir secretos.
- [ ] Verificar rol runtime, propiedad, BYPASSRLS y tenant predeterminado.
- [ ] Añadir backup/restore con dry-run y destinos explícitos.
- [ ] Añadir smoke HTTP para rutas y servicios.
- [ ] Añadir pruebas focales de éxito y cada STOP CONDITION.
- [ ] Ejecutar typecheck, lint, tests, secrets scan y diff check.

## Evidencia externa pendiente

- [ ] Autorización separada de infraestructura Hostinger.
- [ ] Backup y restauración real ensayados.
- [ ] Migraciones aplicadas con rol migrador.
- [ ] Smoke staging con datos ficticios.
- [ ] Aceptación en Edge/Chrome de Paciente, Hospital, Alcaldía y Visitador.
