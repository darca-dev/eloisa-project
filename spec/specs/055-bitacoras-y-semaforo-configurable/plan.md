# Plan 055 — propuesta pendiente

## Enfoque recomendado y alternativas

Reutilizar el monolito modular NestJS/PostgreSQL y portales existentes. Separar bitácora, reglas, evaluación, alarma e historial de `HomeVisit`; un único dominio compartido evita duplicar el motor entre Cuidador, Profesional y Hospital.

Evaluación síncrona transaccional al confirmar una entrada: consistencia y causalidad inmediatas, sin nuevo worker. Coste: guardado más complejo y trabajo acotado por operación. Outbox/worker es alternativa para mayor volumen y entrega externa, pero exige reintentos/reconciliación y añade infraestructura; no se introduce silenciosamente en MP01.

Reglas tipadas individuales frente a umbrales globales: permiten variación por paciente y versionado; requieren competencia y validación clínica. Los umbrales globales del prototipo y las inferencias de IA se descartan porque el Product Owner no los ha autorizado ni validado.

Permisos específicos frente a ampliar VISITS_VIEW/administrador: más trabajo de provisión y pruebas, pero conserva mínimo privilegio y separación clínica. No hay concesión masiva retroactiva.

## Fases y gates

| Paquete | Entrega | Gate de entrada / salida |
|---|---|---|
| MP00 | Especificación, investigación y revisión con Claude; propuestas D01–D07 | Lectura/documentación solamente; revisión PO y contrato completo antes de código |
| MP01 | Custodia/contexto, grants, modelo nuevo, migración aditiva/RLS/auditoría | Decisiones D01/D02 cerradas y allowlist exacta; permisos y dos instituciones/tenants probados |
| MP02 | Bitácora/observaciones/enmiendas persistentes y portales cuidador/visitador/paciente | Formulario y D03/D04 aprobados; guardado/recarga/autoría/enmienda y revocación verificados |
| MP03 | Alarmas manuales y bandeja Hospital mínima | Matriz D02/D03/D06 aprobada; pedir ayuda sin regla llega persistido, sin severidad inferida ni duplicados de reintento |
| MP04 | Reglas individuales versionadas y evaluador automático | Gramática, tiempo y episodios D03–D05 cerrados y validados; cruce de conteo/concurrencia/evidencia pasan |
| MP05 | Seguimiento/asignación/transiciones y estados del semáforo | D06 cerrada; sin verde por ausencia y sin cierre que borre causalidad |
| MP06 | E2E, regresión, seguridad, accesibilidad y auditoría Codex | Evidencia real de todo el flujo con datos ficticios; aceptación PO separada de Git/despliegue |

Las alarmas manuales se entregan como paquete verificable sin esperar a que existan criterios automáticos. Eso no reduce la obligación de entregar también el motor cuando su contrato esté aprobado.

D01 y D02 son prerrequisitos transversales de custodia y autorización humana, no detalles internos del semáforo. Si requieren ampliar el núcleo de organizaciones/permisos fuera de un paquete acotado, se especificarán como dependencia propia antes de MP01; no se decidirá el modelo incidentalmente al implementar alarmas. Se recomienda preservar institución explícita; la alternativa temporal «tenant = custodio único» requeriría aprobación expresa, límites de activación y adaptar criterios de aceptación, y no se adopta en esta propuesta.

La revisión de Claude identificó que el primer incremento adelanta parte de S12 respecto de su secuencia global y difiere outbox/worker. D07 somete esa excepción acotada a aprobación, sin cambiar silenciosamente el plan general ni declarar terminadas las otras dependencias.

## Dependencias

Identidad y aprobación exactas de 054; sesiones OIDC; relación de cuidado; perfil/afiliación/asignación; prisma/withTenant/RLS; auditoría; runner aislado de 025; continuidad S06 y alertas S12 del plan general. Los gates globales no autorizan 055 mientras esté pendiente. Añadir comprobaciones de permiso que reciban la misma transacción de captura y resolver la nueva finalidad de cuidador, sin reutilizar VISITS_VIEW como escritura.

Antes de código: ejecutar `./spec/scripts/check-sdd-gate.sh .` y `./spec/scripts/validate-sdd.sh . --strict`, verificar aprobación y consentimiento específico de 055 sin ejecutar confirm-user-consent por iniciativa de agente. Completar campos del contrato de CLAUDE.md §8 y crear paquete exacto; no usar estado global verde como atajo.

## Riesgos y mitigaciones

- Clínica no validada: sin números/severidades predeterminados; actor competente, aprobación y versiones. Solo ficción hasta autorizar uso real.
- Permisos ampliados indebidamente: grants explícitos, ninguna herencia de VISITS_VIEW/agenda/admin, revocación por operación y pruebas negativas.
- Instituciones dentro de tenant: custodia explícita y RLS/FK adicionales; resolver contrato antes de migraciones.
- Multiplicación o pérdida de alarmas: idempotencia de entrada y serialización paciente/criterio, evidencia y restricciones DB; carreras reales en pruebas.
- Temporalidad/corrección: D04 bloquea el motor hasta acordar semántica; no confundir fecha reportada con recepción.
- Falso verde o entrega: separar sin evaluación, clasificación pendiente, fallo y estabilidad autorizada; respuesta confirmada solo después de commit.
- Confusión de MVP y flujo futuro: WhatsApp/Elí/temporizadores siguen estructuralmente previstos y explícitamente no habilitados.

## Operación y reversión

No tocar Docker, base de aplicación ni cuentas durante MP00. Pruebas futuras en baseline aislada con guardas y datos ficticios. Migraciones nuevas aditivas; no borrar historia ni conceder permisos retroactivos. Cualquier aplicación local, publicación o integración Git debe contar con alcance autorizado propio; la autorización anterior de Git para 054 no se extiende a esta spec.
