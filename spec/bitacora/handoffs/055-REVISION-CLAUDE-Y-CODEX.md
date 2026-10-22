# SPEC 055 — Revisión Claude y auditoría Codex

Fecha: 2026-10-21. Alcance: documentación de diseño y lectura del código relacionado, autorizadas por el Product Owner. Estado: propuesta pendiente; ninguna implementación delegada o ejecutada.

## Ejecución comprobada

Claude Code 2.1.304 con autenticación de suscripción; revisión en modo restringido/plan con herramientas Read/Grep/Glob y sin MCP externo. Primer intento sin resultado por ECONNREFUSED. El reintento de red fue inicialmente rechazado por el control automático al implicar envío externo; el Product Owner autorizó expresamente el alcance antes de reanudar. Revisión final: resultado success, is_error=false y ninguna denegación de herramientas reportada.

El permiso de compartir no es aprobación de decisiones materiales ni consentimiento SDD. La evidencia técnica local está ignorada por Git; aquí se conserva el resumen auditado, no secretos ni datos de pacientes.

## Hallazgos de Claude aceptados por Codex

1. **Autorización del cuidador insuficiente.** `PatientCaregiverPurpose` autoriza HOME_CARE_COORDINATION y excluye uso clínico; CaregiverScope solo contiene VISITS_VIEW. La contribución propuesta exige nueva finalidad/autorización, concesiones expresas, fundamento y pruebas; no reinterpretar la relación antigua.
2. **Perfil profesional no acredita competencia clínica.** El comentario y modelo ProfessionalProfile excluyen título/habilitación/RETHUS. La asignación no es autorización clínica. Debe existir evidencia/competencia habilitante gobernada antes de activar reglas.
3. **Custodia e institución son decisiones transversales.** El modelo actual no representa organización general ni aislamiento RLS institucional dentro del tenant. El criterio de dos instituciones en un tenant necesita ese contrato; no se puede declarar cumplido por una prueba entre dos tenants.
4. **Persona responsable de Hospital.** Las nuevas acciones clínicas deben atribuirse a una HumanAccount autorizada y a su institución; una identidad institucional compartida no basta. No conceder clínica al administrador por inferencia.
5. **Revocación concurrente.** Las políticas actuales de cuidador y asignación abren transacciones propias. Las nuevas operaciones necesitan variantes con PrismaTransaction y un orden de bloqueo coherente con revocación, reglas y alarmas.
6. **Tiempo, versiones y episodios.** Recepción/ocurrencia, eventos tardíos/enmiendas, severidades y criterio de episodio siguen abiertos. La unicidad de alarma abierta debe sostenerse en base y sobrevivir cambios de versión de regla; una restricción SQL específica puede requerir migración manual adicional a lo expresable por Prisma.
7. **Recepción no es atención.** Una alarma manual pendiente debe ser visible sin demorar por reglas/WhatsApp, pero no debe confirmar que alguien la leyó o atiende. Mensajes, responsables y vigilancia de operación real necesitan aprobación.
8. **Plan general.** Evaluación síncrona y primer incremento manual adelantan parte de S12 y difieren outbox/worker. La excepción debe ser expresa y no declarar terminadas S06/S12 ni otras dependencias.

Las observaciones se incorporaron a los requisitos, decisiones y plan de la spec. No se cerraron por inferencia las decisiones materiales.

## Matices de la auditoría Codex

- Claude describió Hospital en términos generales como identidad compartida. La revisión adicional encontró `institutional-audit-actor.ts`, que registra HUMAN_ACCOUNT cuando hay identidad humana validada, y `institutional-auth.service.ts` que admite la ruta administrativa identificada. No se afirma que toda auditoría actual Hospital sea anónima. Sigue faltando la concesión clínica específica de revisión de alarmas.
- La unicidad `(tenantId, experience)` en InstitutionalAdministratorRegistration limita la reserva administrativa actual. No demuestra por sí misma una definición aprobada de «una institución = un tenant» ni reemplaza Organization/custodia.
- Claude sugirió como alternativa rápida declarar un custodio único por tenant temporalmente. Codex no la adoptó: requeriría decisión expresa, restricciones de activación, deuda documentada y cambio de AC09. Se recomienda conservar custodia institucional explícita y resolverla como prerrequisito, sin duplicar arquitecturas Hospital/Alcaldía.
- El bloqueo mediante advisory lock propuesto por Claude es una alternativa técnica, no una decisión ya aprobada. Su clave, colisiones, orden de locks y interacción con revocación deben especificarse en el paquete de concurrencia; no basta nombrar la primitiva.
- La revisión no valida umbrales, taxonomía clínica, mensajes sanitarios ni competencias reales de personas. No se copiaron reglas médicas del prototipo.

## Resultado y siguiente gate

La orientación es coherente —dominio separado de HomeVisit, regla individual sin predeterminados clínicos, vía manual independiente y ausencia de verde por falta de evaluación— pero el contrato todavía no es implementable según CLAUDE.md §8.

El Product Owner debe decidir D01–D07. Después Codex debe concretar el modelo, fuente de concesiones, finalidad/competencias, catálogo/gramática y temporalidad que correspondan al primer paquete; verificar allowlist y aceptación; y comprobar consentimiento/gate específico. Solo entonces Claude recibirá una tarea de implementación. La alarma manual puede entregarse antes del motor, pero no antes de resolver sus propios permisos, custodia, motivos, estados y mensajes.

## Validaciones locales

Gate global: 0 errores y 20 avisos; 055 permanece pendiente. Validación SDD estricta: 0 errores/0 avisos. Diff-check y escaneo de secretos correctos antes de este informe; comprobación final registrada en history. Sin pruebas de producto, build o DB: no se modificó código. Sin commits, push, migraciones ni despliegue por 055.
