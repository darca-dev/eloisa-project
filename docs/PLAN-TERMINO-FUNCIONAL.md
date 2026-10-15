# Plan de término funcional de MERDN / Eloisa

Creado: **8 de octubre de 2026**. Corte vigente: **15 de octubre de 2026**. Responsable de producto: Product Owner. Arquitectura, especificación y auditoría: Codex. Implementación autorizada por el PO a Codex en la conversación vigente, bajo especificación y controles del repositorio.

**Objetivo:** terminar las capacidades existentes como operaciones reales de punta a punta. El trabajo se divide en 15 secciones, cada una con una rama Git propia, dependencias, pruebas y aceptación. La primera entrega funcional será el acceso real para todos los perfiles e instituciones.

**Estado vigente 2026-10-15:** checkpoint `d1bf434` publicado en `eloisa-platform/Eloisa`, rama `feat/completar-modulos-reales`, antes de la revisión de entrega solicitada por el PO. Docker sirve API050/web052. Hospital052 está aplicado y verificado; Configuración municipal053 está escrita pero no ha completado pruebas PostgreSQL, builds del candidato, revisión final ni despliegue. Hay25migraciones en código;053 no se ha aplicado en este trabajo. S01 requiere cerrar inscripción legada y aprobación en APIs propias; S02–S14 conservan trabajo funcional pendiente. No se declara el proyecto listo para entrega integral. Hallazgos, matriz actual y orden de cierre en [REVISION-PREENTREGA-2026-10-15.md](REVISION-PREENTREGA-2026-10-15.md).

**Referencia histórica 2026-10-12:**040/041 tuvieron baseline de31etapas/2626pruebas y23migraciones. Esa evidencia no valida el candidato053. Las menciones posteriores a cupos libres, cero cuentas y defectos iniciales son registros históricos; ya se crearon las cuentas locales Hospital/Alcaldía/Paciente solicitadas por el PO. Sus credenciales permanecen privadas.

## 1. Instrucción de producto y contrato de entrega

La instrucción del Product Owner de esta sesión exige: terminar funcionalmente, dividir por secciones, usar una rama por sección, cerrar primero los accesos, eliminar comportamiento demo del producto entregable y crear datos de acceso para testear.

1. Toda acción de negocio ofrecida ejecuta su API autorizada y persiste en la fuente de verdad. Recargar, reiniciar servicios o abrir otra sesión autorizada no pierde el resultado.
2. Login, registro, revisión, aprobación, sesión, recuperación, permisos y logout usan IdP y servicios reales. No hay usuarios declarados en un arreglo de UI, sesión inyectada ni botón que simule éxito.
3. Los datos de test son ficticios y explícitos; el funcionamiento es real. Las cuentas se crean en el IdP y se vinculan con el subject emitido por él. TEST_DATA identifica la procedencia y no concede permisos.
4. Mocks siguen permitidos en pruebas unitarias aisladas. No satisfacen aceptación integrada ni se usan como fuente de datos del producto.
5. Un manual workflow aprobado también es real: carga, validación, consulta, versión, evidencia y auditoría persistentes. Si no hay integración externa autorizada, se registra la fuente y el estado del intercambio sin simular una conexión oficial.
6. No se marca una sección ni el proyecto como terminado mediante ocultamiento de capacidades, datos hardcodeados, etiquetas demo, pruebas omitidas o porcentajes arbitrarios.
7. Las capacidades aún sin implementación permanecen en este plan con responsable y dependencia. En entregas intermedias se declaran pendientes y no confirman una operación ficticia. Al cierre integral, todo el alcance acordado debe estar aceptado.

Este plan sustituye como objetivo futuro la tolerancia a demos expresada en algunas tareas de ENTREGA.md. La auditoría permanece como evidencia del snapshot inspeccionado. En particular, FIX-019 (solo rotular demos) debe reemplazarse por retirar el comportamiento simulado del flujo y completar cada capacidad; no basta cambiar su etiqueta.

## 2. Base y documentación autoritativa

Fuentes: AGENTS.md, CLAUDE.md, docs/PRODUCT.md, MODULES.md, ROLES.md, DATA.md, ARCHITECTURE.md y SECURITY.md; decisiones y specs aprobadas del repositorio que se elija. [ENTREGA.md](../ENTREGA.md) aporta diagnóstico, 23 bugs, 177 tareas y comparación de tres snapshots.

- Repositorio original: la auditoría y el plan quedaron publicados en `eloisa-platform/Eloisa`, rama `docs/auditoria-entrega-2026-10-08`, commit `ebcfdfe48e2270c2913e572f0e37dad8eba4b865`. No es la base de implementación elegida.
- Copia del escritorio: se conservó en OneDrive como respaldo. Su `main` permanece en `1aa1201b8aa4483ecac6ffc59e15cb16cd79270b`.
- Base elegida: copia fuera de OneDrive del avance `origin/develop` local `9980582bc40f41c80b90078f0c24374cbad9df9e`. Origin de esta historia: `https://github.com/arvtechv/eloisa_project.git`; fetch falló con “Repository not found”, sin confirmar inexistencia del repositorio. No se cambió el remoto ni se fusionaron historias.
- Las historias inspeccionadas no tienen hashes comunes. Consolidar repositorios exige decisión y trazabilidad; no copiar ni fusionar todo por comodidad.

El diseño aprobado se conserva como referencia. prototype-claude/, tasks/ y reviews/ siguen protegidos. No se alteran para hacer pasar el cierre. El stack aprobado permanece; este plan no elige un nuevo stack, una regla clínica ni un procesador de pagos.

Los planes de sección deben convertirse en bundles canónicos spec/specs/<NNN-slug>/ con spec.md, plan.md, tasks.md e history.md al fijar la base y la numeración disponible. No se crean specs competidoras ni se reescriben las aprobadas silenciosamente. Los documentos de esta carpeta son propuestas, no aprobación ni consentimiento SDD.

## 3. Trabajo por rama y control de avances

Cada sección usa la rama de la tabla siguiente. Las ramas se crean cuando empieza su sección, desde el develop del repositorio elegido que contenga las dependencias aceptadas. No se crearán 15 ramas congeladas desde un commit viejo.

Ciclo de trabajo por sección:

1. Fijar repo, base SHA, alcance y dependencias aceptadas. Preparar spec/plan/tasks suficientes, con allowlist por micro-paquete.
2. Resolver decisiones materiales aplicables y registrar la aprobación/consentimiento reales conforme a SDD. La solicitud de planificación no equivale a aprobar decisiones aún abiertas.
3. Crear la rama de esa sección y trabajar un micro-paquete a la vez. Mantener dentro de ella las correcciones focales hasta aceptación.
4. Claude implementa y ejecuta las pruebas del paquete. Devuelve archivos, comandos, resultados, errores y evidencias del HEAD correcto.
5. Codex audita código, datos, permisos, tenant, seguridad, accesibilidad y cumplimiento de la spec. Corrige Claude y se verifica otra vez.
6. Product Owner acepta la sección. Commit, push, PR e integración se realizan cuando exista autorización aplicable; una rama creada no autoriza merge ni despliegue.
7. Tras integración autorizada a develop, registrar el SHA resultante. Crear la siguiente rama desde esa base actualizada. main queda protegido.

No usar git add . para incorporar cambios previos ajenos. Un commit debe tener alcance identificable. No reset, limpieza de archivos, borrado de ramas, rebase/force-push o cambios de historial para simplificar la secuencia.

Registro mínimo de cada sección: ID, spec/versión, rama, base SHA, estado, micro-paquete activo, archivos permitidos, decisiones pendientes, tests ejecutados, tests omitidos, hallazgos, commit/imagen auditados, resultado Codex, aceptación PO e integración autorizada. Se guarda en history.md/tasks.md del bundle y en los handoffs vigentes; una etiqueta READY no equivale a aceptación.

Estados: PLANIFICADA → ESPECIFICADA → APROBADA → EN IMPLEMENTACIÓN → EN AUDITORÍA → ACEPTADA → INTEGRADA. Un impedimento se registra como BLOQUEADA con causa y siguiente acción; la aceptación del usuario no se inventa. El estado de integración se separa del cierre funcional.

## 4. Secciones y orden propuesto

Trabajaremos secuencialmente S00 a S14. El número indica el orden normal. Las dependencias permiten reconocer reutilización; no autorizan paralelismo ni saltar pruebas. La orden posterior del PO añade una rama por paquete revisable y un commit local al terminarlo, manteniendo trazabilidad dentro de cada sección.

| Sección | Resultado | Rama nueva al iniciar | Dependencias mínimas | Estado actual |
|---|---|---|---|---|
| S00 | Base de trabajo y entorno verificable | `feat/termino-00-base-y-baseline` y ramas por MP | — | Base y runner operativos; repetir baseline del candidato final |
| S01 | Accesos, registro y ciclo de cuenta | `feat/termino-01-accesos-reales` | S00 | PARCIAL: login/registro/recovery operativos; bloqueos PE-01/02 abiertos |
| S02 | Personas, relaciones y consentimientos | `feat/termino-02-personas-relaciones-y-consentimientos` | S01 | PLANIFICADA |
| S03 | Alcaldía, programas y población | `feat/termino-03-alcaldia-programas-y-poblacion` | S02 | PARCIAL: agregados reales; captura053 en curso, sin desplegar |
| S04 | Documentos y evidencia institucional | `feat/termino-04-documentos-y-evidencias` | S02, S03 | PLANIFICADA |
| S05 | Hospital, agenda y visitas domiciliarias | `feat/termino-05-hospital-agenda-y-visitas` | S02 | PARCIAL: consultas/asignación/transiciones; falta cerrar gestión de citas y recorrido profesional |
| S06 | Portales y continuidad del cuidado | `feat/termino-06-portales-y-continuidad-de-cuidado` | S05, S04 | PARCIAL: consultas propias/worklist; acciones persistentes y PE-03 pendientes |
| S07 | Finanzas, presupuesto y contratos | `feat/termino-07-finanzas-presupuestos-y-contratos` | S03, S04 | PLANIFICADA |
| S08 | Hub, indicadores y gestión institucional | `feat/termino-08-hub-indicadores-y-gestion-institucional` | S03, S04, S07 | PLANIFICADA |
| S09 | Formación, cuidadores y SENA | `feat/termino-09-formacion-cuidadores-y-sena` | S02, S04, S08 | PLANIFICADA |
| S10 | Servicios, planes, cobros y referencias de pago | `feat/termino-10-servicios-planes-y-cobros` | S05, S04, S07 | PLANIFICADA |
| S11 | Consultas virtuales y coordinación | `feat/termino-11-consultas-virtuales-y-coordinacion` | S05, S06, S04 | PLANIFICADA |
| S12 | Alertas, notificaciones y ayuda Elí | `feat/termino-12-alertas-notificaciones-y-eli` | S06, S03, S08, S09, S11 | PLANIFICADA |
| S13 | Reportes ejecutivos, tableros y exportaciones | `feat/termino-13-reportes-y-tableros` | S06, S03, S07, S08, S09, S10, S11, S12 | PLANIFICADA |
| S14 | Cierre funcional integral y operación | `feat/termino-14-cierre-integral-y-operacion` | S00, S01, S02, S05, S06, S03, S04, S07, S08, S09, S10, S11, S12, S13 | PLANIFICADA |

S00 hace segura y reproducible la ejecución; no declara entregable una baseline roja. S01 cierra la puerta de acceso con fixtures explícitos y no espera a construir finanzas o el Hub. Las relaciones/asignaciones de prueba se preparan como fixtures auditados mínimos, y su administración funcional se completa en S02.

### S00. Base de trabajo y entorno verificable

**Objetivo:** Fijar un único repositorio y commit; disponer de aplicación, API, PostgreSQL e IdP reales en un entorno aislado y reproducible.

**Rama:** `feat/termino-00-base-y-baseline`. **Dependencias:** ninguna; fija la base de las siguientes.

Entregables:

- Reconciliar las dos copias, los handoffs y los cambios locales; inventariar lo implementado en el commit candidato.
- Reproducir builds, lint, tipos, tests y catálogo RLS/owners/runtime; completar el runner aislado y proteger seed/cleanup por runId.
- Corregir composición Docker, URL de API compilada, recursos públicos, fuente y configuración institucional; comprobar imagen exacta.
- Registrar resultados y defectos heredados sin convertir una baseline roja en aceptada.

**Cierre verificable:** Entorno aislado identificado; servicios saludables; build reproducible; migrations/catalog/runtime y aislamiento crítico comprobados sin skips; ninguna operación usa datos o volúmenes ajenos.

**Componentes previstos:** compose*.yml; scripts/testing/; prisma/migrations/ nuevas; Dockerfiles; config; tests de baseline; docs/runbooks.

**Decisiones:** D-01 base/commit; reconciliación SDD. Baseline de release completa sigue siendo requisito de S14.

### S01. Accesos, registro y ciclo de cuenta

**Objetivo:** Terminar el acceso real de Paciente, Cuidador, Visitador, Hospital y Alcaldía, con actor individual y permisos derivados en backend.

**Rama:** `feat/termino-01-accesos-reales`. **Dependencias:** S00.

Entregables:

- Registro de tres perfiles; solicitud persistida, revisión Hospital y provisión OIDC con sub real; reconciliar la vía legada.
- Login, recuperación, aprobación, selección de experiencia, entrada directa, sesión, expiración, suspensión, revocación y logout reales.
- Autenticación institucional atribuible; conservar roles y capacidades disjuntos. Una identidad válida no recibe automáticamente permisos.
- Crear el dataset de accesos en DB/IdP de test y entregar las credenciales por archivo local protegido; ejecutar matriz positiva y negativa.

**Cierre verificable:** Todos los recorridos de acceso y APIs correspondientes pasan con IdP/DB reales; pendiente/rechazado/revocado no entra; paciente directo exige aprobación; superficie errónea y tenant ajeno denegados; no atajos demo; auditoría correlacionada y cero contraseñas en Git/logs.

**Componentes previstos:** human-auth/; identity-access/; institutional-auth/; access-requests/; patients/ vía legada; accesos web; tools de identidad/seed; tests.

**Decisiones:** D-02 atribución institucional y compatibilidad; D-03 TTL/MFA/recuperación; D-04 provisión y reset test. Detalle en 01-ACCESOS-REALES.md.

### S02. Personas, relaciones y consentimientos

**Objetivo:** Administrar personas, perfiles, afiliaciones y vínculos sin convertir el registro en autorización sobre terceros.

**Rama:** `feat/termino-02-personas-relaciones-y-consentimientos`. **Dependencias:** S01.

Entregables:

- CRUD autorizado de datos personales, archivos/desactivaciones y búsqueda/paginación con validación y versión.
- Cuidador-paciente muchos-a-muchos: solicitar, validar, activar, revocar y expirar con alcances y evidencia.
- Alta/verificación profesional, afiliación y asignaciones vigentes; estado declarado separado de verificación.
- Consentimientos y delegaciones con origen, alcance y revocación; auditoría de expiración y control de concurrencia.

**Cierre verificable:** Cuidador sin vínculo no ve pacientes; vínculo vencido/revocado pierde acceso; profesional sin afiliación/asignación no consulta terceros; desactivación afecta sesiones/relaciones según contrato; recarga conserva los cambios.

**Componentes previstos:** people-relationships/; identity-access/; patients/; consents/; hospital profesionales; formularios por perfil; migrations nuevas.

**Decisiones:** Autoridad de validación, representación, campos editables y retención por definir en la spec; no inventar fundamento jurídico.

### S03. Alcaldía, programas y población

**Objetivo:** Hacer operativos los módulos territoriales e institucionales de Alcaldía sobre capacidades compartidas.

**Rama:** `feat/termino-03-alcaldia-programas-y-poblacion`. **Dependencias:** S02.

Entregables:

- Configuración institucional/territorial y programas parametrizados; responsables, cobertura y población beneficiaria.
- Alta, edición, archivo, búsqueda, filtros y detalle conforme a cada capacidad; no duplicar Person/Patient.
- Agregados reales con periodo y procedencia; separación de consulta agregada y nominal autorizada.
- Contexto municipal real; limpiado de datos tras 401/403; pruebas de organizaciones sin relaciones autorizadas.

**Cierre verificable:** Crear programa y relacionar beneficiarios refleja resultados en listados/agregados; periodos y filtros se aplican en servidor; cuenta municipal no abre recursos clínicos ni nominales fuera de finalidad aprobada.

**Componentes previstos:** municipality/; features/municipality/; dominios de instituciones/territorio/programas compartidos; contracts/migrations/tests.

**Decisiones:** Modelo de organización/territorio, supresión de grupos pequeños y acceso nominal requieren aprobación específica.

### S04. Documentos y evidencia institucional

**Objetivo:** Disponer de evidencia privada, persistente y trazable que puedan utilizar cuidado, finanzas y Hub.

**Rama:** `feat/termino-04-documentos-y-evidencias`. **Dependencias:** S02, S03.

Entregables:

- Carga real, metadatos, recurso padre, versión, revisión, descarga autorizada y archivo.
- Abstracción de almacenamiento privado aprobada; validación de tipo/tamaño, nombres seguros e integridad.
- Clasificación/sensibilidad/fuente/autor/fecha y permisos heredados evaluados en servidor.
- Concurrencia, archivo retenido, fallos de almacenamiento y vínculo DB sin documentos huérfanos.

**Cierre verificable:** Archivo subido se descarga íntegro únicamente por actor autorizado; tenant distinto y URL adivinada denegados; versión e historial conservados; backup y restore coordinados se ensayan en S14.

**Componentes previstos:** dominio evidence/documents a especificar; adapter de almacenamiento; apps API/web; migrations; volume config; tests.

**Decisiones:** Categorías, límites, retención y significado de aprobación documental; no afirmar firma o valor probatorio no implementado.

### S05. Hospital, agenda y visitas domiciliarias

**Objetivo:** Completar la operación hospitalaria desde la cita hasta el cierre de la visita asignada.

**Rama:** `feat/termino-05-hospital-agenda-y-visitas`. **Dependencias:** S02.

Entregables:

- Pacientes/profesionales/listas/detalles reales; filtros y paginación de servidor; limpiar datos al perder permisos.
- Crear, editar, cancelar y asignar citas conforme al contrato aprobado; zona horaria y restricciones explícitas.
- Materializar visita y ejecutar transiciones autorizadas, evidencia, incidencias y correcciones con historial.
- Worklist profesional conectada a acciones reales; Hospital consulta el mismo registro, sin duplicarlo.

**Cierre verificable:** Cita→asignación→worklist→visita→cierre comprobado con sesiones separadas; doble acción/concurrencia no duplica visita; cancelación y fallo mantienen integridad; listado no expone registros ajenos.

**Componentes previstos:** hospital/; visits/; HospitalShell/Agenda/Patients/Professionals; profesional worklist; schemas/contracts/tests.

**Decisiones:** Zona horaria, estados, reprogramación/cancelación y evidencia de cierre aprobados antes de cada operación.

### S06. Portales y continuidad del cuidado

**Objetivo:** Completar las acciones reales de Paciente, Cuidador y Profesional sobre registros autorizados.

**Rama:** `feat/termino-06-portales-y-continuidad-de-cuidado`. **Dependencias:** S05, S04.

Entregables:

- Inicio, citas, visitas, detalles y bitácora desde API; acciones y feedback persistentes; corrección versionada.
- Registro de novedades y contenido no diagnóstico según formulario aprobado; autoria/fecha/tenant/evidencia.
- Información clínica y medicamentos únicamente desde fuente hospitalaria autorizada con procedencia y actualización.
- Retirar guardados en memoria y liquidaciones ficticias del flujo; conectar el dominio S07/S10 cuando esté listo.

**Cierre verificable:** Todas las acciones del flujo de cuidado acordado se recuperan al recargar y desde otra sesión autorizada; no se muestran identidades ni registros estáticos; self-scope y relaciones se vuelven a comprobar en backend. Liquidaciones se aceptan aparte en S07/S10.

**Componentes previstos:** features/paciente/; features/caregiver/; features/profesional/; patient-self/; bitácora/continuidad a especificar; contratos de fuente clínica.

**Decisiones:** Campos, autoría, correcciones y dataset clínico autorizado. Cierre integral de liquidaciones depende de S07/S10 aunque la sección opere primero.

### S07. Finanzas, presupuesto y contratos

**Objetivo:** Completar la trazabilidad institucional de recursos y ejecución con soporte real.

**Rama:** `feat/termino-07-finanzas-presupuestos-y-contratos`. **Dependencias:** S03, S04.

Entregables:

- Presupuesto, fuente, periodo, asignación, movimiento y ejecución; relaciones a actividad/programa/servicio.
- Proveedores, contratos y versiones; gasto, solicitud, aprobación, soporte y seguimiento.
- Separación creador/aprobador y permisos FIN; anulaciones/ajustes conservan historial.
- Antes de implementar aprobaciones, conciliar ese requisito con la decisión vigente de un único administrador institucional y sin nuevos empleados/roles. No crear otro rol ni permitir autoaprobación por defecto; definir el flujo autorizado del paquete financiero.
- Totales y conciliación reproducibles; contrato financiero de indicadores consumido en S08; liquidaciones y cargos cerrados en S10 desde hechos persistidos.

**Cierre verificable:** Una ejecución ficticia de prueba recorre asignación→gasto→aprobación→soporte→reporte; totales coinciden y no se duplican por reintento; sin datos clínicos innecesarios; ninguna liquidación se confirma solo en React.

**Componentes previstos:** dominios budget/finance/suppliers/contracts a especificar; Hospital/Alcaldía finanzas; evidence; migrations; tests.

**Decisiones:** Reglas de montos, ajustes, incompatibilidades, moneda y aprobación; no se adopta contabilidad gubernamental ni gateway.

### S08. Hub, indicadores y gestión institucional

**Objetivo:** Operar evidencia, responsables, brechas e indicadores para los marcos institucionales protegidos.

**Rama:** `feat/termino-08-hub-indicadores-y-gestion-institucional`. **Dependencias:** S03, S04, S07.

Entregables:

- Hub extensible para entidad, norma/obligación, fuente, periodo, responsable, acción, brecha y evidencia.
- FURAG/MIPG, ADRES y Sentencia T-319 de 2025 representados con gestión persistente y versiones.
- Indicadores con fórmula, fuente, owner, periodo, fecha, versión, linaje y evidencia; cálculo reproducible.
- Importación/control manual real cuando no exista integración autorizada, con catálogo de disponibilidad y fallas.

**Cierre verificable:** Crear obligación y evidencia, asignar responsable, registrar acción y calcular indicador produce resultado verificable; fuente/estado siempre visible; no se inventa puntuación oficial ni conformidad legal total.

**Componentes previstos:** dominios hub/indicators/integrations a especificar; vistas Hospital/Alcaldía; evidence/finance; migrations/contracts/tests.

**Decisiones:** Fuentes autorizadas, fórmulas y obligaciones aprobadas por responsables; ninguna interpretación normativa se resuelve por defecto.

### S09. Formación, cuidadores y SENA

**Objetivo:** Gestionar formación y evidencia de certificación del cuidador con trazabilidad.

**Rama:** `feat/termino-09-formacion-cuidadores-y-sena`. **Dependencias:** S02, S04, S08.

Entregables:

- Oferta/proveedor de formación, inscripción, seguimiento y finalización persistentes.
- Carga de certificado, verificación separada y vínculo a competencia/perfil según reglas aprobadas.
- SENA representado como fuente/oferta verificable; intercambio documental controlado si no hay API autorizada.

**Cierre verificable:** Inscripción→avance→evidencia→verificación se conserva en DB; declarar formación no produce certificado oficial; únicamente responsables autorizados verifican.

**Componentes previstos:** dominio training a especificar; cuidador/formación; evidence; API/migrations/tests.

**Decisiones:** Quién verifica, estados/fechas, fuente y reglas de equivalencia; no generar certificación oficial ficticia.

### S10. Servicios, planes, cobros y referencias de pago

**Objetivo:** Completar la cadena comercial hospitalaria sin afirmar procesamiento productivo de pagos.

**Rama:** `feat/termino-10-servicios-planes-y-cobros`. **Dependencias:** S05, S04, S07.

Entregables:

- Catálogo de servicios/capacidad y precios/versiones aprobadas; membresías y planes con términos vigentes.
- Prestación→cargo→referencia de pago/conciliación manual→soporte→ingreso visible.
- Liquidaciones y estados derivados de la fuente financiera real; sin botón de pago que simule cobro.
- Adaptador de pago permanece sin activar hasta spec separada si se decide cobrar con proveedor real.

**Cierre verificable:** Servicio prestado y cargo real de prueba producen referencia conciliable y soporte; filtros/totales/reembolsos o ajustes aplicables tienen contrato y auditoría; precio no proviene de hardcode de presentación.

**Componentes previstos:** dominios services/plans/memberships/charges a especificar; liquidaciones Hospital/caregiver/profesional; finance/evidence/tests.

**Decisiones:** Tarifas, condiciones, devoluciones y autoridades; gateway solo con aprobación independiente. El alcance aprobado actual admite referencias manuales persistentes.

### S11. Consultas virtuales y coordinación

**Objetivo:** Gestionar citas virtuales y su continuidad de forma verificable y autorizada.

**Rama:** `feat/termino-11-consultas-virtuales-y-coordinacion`. **Dependencias:** S05, S06, S04.

Entregables:

- Cita virtual, participante, enlace o coordinación externa controlada, estados e incidencia.
- Acceso a enlace limitado a participantes; registro de asistencia/cierre y evidencia según contrato.
- Conectar la actividad con continuidad y servicio prestado; proveedor de video solo si está aprobado.

**Cierre verificable:** Consulta programada se abre por participantes autorizados y permite registrar resultado administrativo real; cancelar/reprogramar queda trazado; no se finge una videollamada integrada ni se guarda grabación no aprobada.

**Componentes previstos:** agenda/visits/continuity; dominio virtual consultation a especificar; evidence; front por rol/tests.

**Decisiones:** Proveedor o flujo manual, participantes, datos permitidos y conservación; grabación fuera de alcance hasta aprobación.

### S12. Alertas, notificaciones y ayuda Elí

**Objetivo:** Hacer reales los seguimientos y avisos internos, con ayuda accesible y contenidos aprobados.

**Rama:** `feat/termino-12-alertas-notificaciones-y-eli`. **Dependencias:** S06, S03, S08, S09, S11.

Entregables:

- Novedad/alerta manual por dominio, responsable, prioridad aprobada, acción y cierre.
- Bandeja interna y outbox/worker idempotente según arquitectura; estados de entrega/reintento reales.
- Elí guía navegación, formularios y educación con contenido versionado y contexto autorizado.
- Canales externos solo por integración aprobada; no mantener éxitos simulados de correo/SMS/WhatsApp.

**Cierre verificable:** Evento persistido genera aviso interno real y seguimiento auditable; fallo/reintento no duplica; ayuda accesible no diagnostica/prescribe; usuario no recibe contenido de otro tenant.

**Componentes previstos:** alerts/notifications/outbox/worker a especificar; EliBubble y contenido; Hospital/Alcaldía/portales; tests.

**Decisiones:** Prioridades, escalamiento, plantillas, canales y contenido; reglas clínicas automáticas requieren validación independiente.

### S13. Reportes ejecutivos, tableros y exportaciones

**Objetivo:** Sustituir métricas estáticas por resultados verificables y exportaciones autorizadas.

**Rama:** `feat/termino-13-reportes-y-tableros`. **Dependencias:** S06, S03, S07, S08, S09, S10, S11, S12.

Entregables:

- Dashboards por rol sobre agregados de servidor con periodo, filtros, fuente y linaje.
- Reportes operativos, financieros e institucionales; minimizar nominal y aplicar permiso de exportar.
- Archivos de reporte reales, snapshot/versionado y auditoría de descarga/exportación.

**Cierre verificable:** Dataset conocido produce los mismos totales en pantalla, API y exportación; cambiar periodo modifica la consulta; datos vacíos/error no inventan resultados; tenant equivocado denegado.

**Componentes previstos:** reporting/indicators a especificar; HospitalReports; MunicipalityReports; charts/export; tests.

**Decisiones:** Campos, formatos, audiencias, filtros, supresión y retención; no inventar valores oficiales.

### S14. Cierre funcional integral y operación

**Objetivo:** Aceptar el proyecto con evidencia por capacidad y operación recuperable.

**Rama:** `feat/termino-14-cierre-integral-y-operacion`. **Dependencias:** S00, S01, S02, S05, S06, S03, S04, S07, S08, S09, S10, S11, S12, S13.

Entregables:

- Suite integrada, permisos A/B, accesibilidad, contratos, CRUD, filtros y fallas; ningún test crítico omitido.
- Detectar accesos/acciones/datos demo aún alcanzables y cerrar cada capacidad del inventario.
- Ensayar backup/restore de DB, identidad y archivos; observabilidad, secretos, readiness y runbooks.
- Aceptación Product Owner por rol y módulo; baseline verde del commit exacto, artefactos e informe de riesgos residuales.

**Cierre verificable:** Todas las capacidades del contrato de entrega pasan; cero bloqueos críticos/altos abiertos, cero éxitos ficticios; restauración probada; verificación sobre las imágenes entregables; uso de datos reales y despliegue solo tras sus aprobaciones separadas.

**Componentes previstos:** tests/CI/operación/runbooks; reportes y handoffs vigentes; configuración aprobada; cambios correctivos solo por spec.

**Decisiones:** RPO/RTO, retención, entorno de entrega y riesgos residuales aceptables; main/producción no se autorizan por este plan.

## 5. Primer hito: accesos terminados

La sección S01 tiene un [contrato detallado y 12 micro-paquetes](plan-funcional/01-ACCESOS-REALES.md). Se apoya en el [catálogo de 32 cuentas/escenarios de prueba](plan-funcional/catalogo-accesos-prueba.json). Los alias del catálogo no son usernames ni credenciales activas.

El recorrido que debe probarse es:

registro de Paciente/Cuidador/Visitador → solicitud PENDING persistida → revisión Hospital atribuible → decisión → provisión IdP confirmada → APPROVED → login OIDC → experiencia autorizada → recurso propio/delegado/asignado → suspensión/revocación → denegación en siguiente petición → logout real.

Hospital y Alcaldía tienen acceso institucional con actor individual y capacidad concreta. No se usan datos de test ni un rol de UI para pasar sus guards. La atribución institucional y la compatibilidad con la sesión existente deben especificarse antes de implementar esa transición.

La prueba positiva de Cuidador con relación o Profesional con asignación no convierte esas autorizaciones en efectos de registrarse o aprobarse. Se prueban aparte los perfiles aprobados sin vínculo/asignación: abren su portada limitada y no ven datos de terceros.

Criterios irrenunciables del hito:

- /paciente escrita directamente y cada API self-scope comprueban aprobación vigente, además de cuenta/participación/tenant, salvo una excepción de compatibilidad expresamente aprobada.
- Ninguna cuenta pendiente, rechazada, suspendida, revocada o con provisión fallida obtiene el acceso solicitado.
- Una cuenta con varios perfiles no suma permisos sobre el mismo recurso. Un cargo de administrador no concede lectura clínica/financiera por defecto.
- Logout y revocación invalidan sesión en servidor; respuestas tardías/cachés no repueblan datos. CORS/origen/cookies/proxy/cuotas se verifican en el entorno real.
- Pérdida de IdP, DB o auditoría obligatoria falla de forma cerrada; nunca se inventa un sub ni se devuelve aprobación sin identidad confirmada.
- Controles de demo local quedan fuera del recorrido aceptado. Se verifica el servidor y la imagen correctos con esas banderas apagadas.

## 6. Dataset y entrega de credenciales de test

Se preparó el diseño de 32 identidades/escenarios: 18 humanos, 10 institucionales (cinco roles en cada uno de dos tenants aislados) y cuatro escenarios privilegiados/financieros futuros. Los últimos cuatro no se provisionan hasta que su contrato de permisos esté aprobado.

La creación real es entregable de S01, con ejecución aislada autorizada y un comando de seed a especificar. S00 primero prueba identidad de recursos y entorno; no se ejecutará contra el realm ni la DB del escritorio por deducción de una ruta.

1. Generar un runId y perfiles ficticios; usar fuente TEST_DATA, aliases deterministas y subjects reales del IdP. Identificadores de negocio, correo y login se producen bajo el contrato de validación de la base elegida.
2. Crear cuentas aprobadas de test mediante el flujo administrativo auditado explícito; crear los estados negativos con fixtures controlados. No relajar los permisos de la aplicación para permitir el seed.
3. Crear relaciones, scopes y asignaciones únicamente para los casos que las declaran. Conservar evidencia de qué fixture las creó.
4. Generar una contraseña aleatoria por cuenta; aplicar política IdP y MFA real para perfiles privilegiados según la decisión aprobada.
5. Verificar en IdP/DB el vínculo issuer+sub, estado, tenant y capacidades. Solo una cuenta verificada entra en la entrega de accesos.
6. Entregar URLs reales, login, contraseña de test y método MFA por un archivo local protegido, por ejemplo .secrets/accesos-test/<runId>.json, cuya exclusión se comprueba antes de escribir. Nunca en Git, UI, auditoría, logs ni este plan.
7. Probar seed repetido e idempotencia. Cleanup valida recursos/tenant/runId y conserva datos ajenos e historial; reset de auditoría solo mediante decisión explícita.

**Estado de este turno:** catálogo diseñado; cero cuentas activas creadas y ninguna contraseña emitida. No se presenta el catálogo como evidencia de login exitoso.

## 7. Matriz de pruebas común

| Área | Evidencia exigida en la sección afectada |
|---|---|
| Datos/persistencia | Create/read/update/archive aplicables; recarga/reinicio; validación externa; duplicados; integridad referencial y versión; migración/rollback |
| Autenticación | IdP real, issuer/audience/PKCE/state/nonce, sesión, expiración, recuperación y logout; error de proveedor y timeout efectivo |
| Autorización | Permiso por acción y recurso; relación/asignación/consentimiento; superficie equivocada; solicitud/capacidad no aprobada |
| Aislamiento | Dos tenants y organizaciones sin relación; acceso por ID/listado/export/archivo; runtime real sin SUPERUSER/BYPASSRLS; catálogo completo |
| Auditoría | Actor/recurso/tenant/acción/resultado; confirmación en DB; fallo de auditoría obligatoria no sirve éxito; sin secretos/PII innecesaria |
| Interfaz | Búsqueda/filtros/paginación reales; loading/empty/error; doble submit; limpieza al perder sesión/contexto; navegador actual servido desde commit correcto |
| Accesibilidad | Teclado y foco, trap modal, labels, errores, lector/semántica, contraste y 320 px; axe con revisión de los casos que no cubre |
| Operación | Imagen reproducible, readiness, configuración, secretos, fallo/reintento, backup/restore y evidencias de recuperación |

Tests unitarios con mocks complementan las pruebas reales; no las sustituyen. Un skip, return temprano por falta de DB, salida de otra ruta/HEAD o interceptor que siempre responde éxito no demuestra aceptación.

El gate SDD y validate --strict se ejecutan antes de código productivo, según AGENTS.md. No ejecutaremos confirm-user-consent.sh por iniciativa del agente. Los paquetes deben cubrir el contrato §8 de CLAUDE.md; el template por sí solo no es suficiente.

## 8. Definition of Done por sección

Una sección se acepta cuando su spec está satisfecha, todas sus acciones acordadas funcionan con datos persistentes, las pruebas obligatorias están verdes y sin omitidos, no hay hallazgos críticos/altos pendientes de ese alcance, Codex verificó las correcciones y el Product Owner aceptó el commit auditado.

Debe existir evidencia del escenario positivo y de la denegación, no solo captura de pantalla. El paquete documenta regresiones, errores, migración, compatibilidad, rollback y operación. El resultado no introduce una integración, autoridad oficial o permiso fuera del contrato.

Los módulos posteriores pueden ampliar una sección ya aceptada mediante su propia spec y rama, como S10 consume los portales para las liquidaciones. Eso no convierte una dependencia futura en una función ya terminada. El progreso global se mide por capacidades aceptadas contra el inventario acordado, no por número de pantallas o commits.

## 9. Cobertura de los 33 dominios

Matriz derivada de docs/ROLES.md §8.4. Los roles R1–R15 de ese documento son referencias funcionales recomendadas; no se declaran todos implementados ni se asignan por este plan.

| Dominio | Secciones responsables |
|---|---|
| Cuenta e identidad | S01 |
| Personas | S02 |
| Pacientes | S02, S06 |
| Cuidadores | S02, S06 |
| Profesionales | S02, S05, S06 |
| Relaciones y consentimientos | S02 |
| Programas | S03 |
| Agenda | S05 |
| Bitácora | S06 |
| Visitas | S05 |
| Consultas virtuales | S11 |
| Información clínica autorizada | S06 |
| Medicamentos | S06 |
| Novedades y alertas | S12 |
| Documentos y evidencias | S04 |
| Formación y SENA | S09 |
| Población beneficiaria | S03 |
| Indicadores | S08, S13 |
| FURAG/MIPG | S08 |
| ADRES | S08 |
| T-319 y Hub Normativo | S08 |
| Presupuesto | S07 |
| Gastos | S07 |
| Proveedores | S07 |
| Contratos | S07 |
| Servicios comerciales | S10 |
| Membresías | S10 |
| Pagos: referencias/estados autorizados | S10 |
| Ingresos hospitalarios | S07, S10 |
| Reportes | S13 |
| Auditoría | Todas; aceptación S14 |
| Configuración | S00, S01, S03 |
| Integraciones | S04, S08, S09, S11, S12; gobierno S14 |

Quedan protegidos: cuidado domiciliario y continuidad; experiencias Hospital/Alcaldía; gestión/evidencia institucional; fórmulas y porcentajes; FURAG/MIPG; información/evidencia ADRES; T-319 y hub extensible; SENA/formación; presupuesto/movimientos/gastos/soportes; proveedores/contratos; agenda/visitas/consulta virtual; pagos aprobados/referencias; membresías/planes/servicios hospitalarios/ingresos; reportes ejecutivos y auditoría. Ninguno se elimina por falta de integración automática.

## 10. Trazabilidad del diagnóstico y riesgos

[TRAZABILIDAD-AUDITORIA.md](plan-funcional/TRAZABILIDAD-AUDITORIA.md) asigna las 177 tareas existentes sin perder IDs ni dependencias. No todas siguen faltando en la rama C: cada una se clasifica en S00 como implementada/verificada, implementada/no verificada, faltante, defectuosa o sustituida por una decisión nueva. Se debe evitar reimplementar lo que ya está correcto.

Se añaden requisitos de esta solicitud no suficientemente descompuestos en el backlog anterior: acceso institucional individual, recuperación real, seed/credenciales de test, consulta virtual completa y sustitución del comportamiento demo. Se especifican por sección, no se inventa un estado de aprobación.

Los hallazgos CMP-02/CMP-03 (provisión legada), CMP-04 (aprobación en acceso directo Paciente), CMP-05 (expiración/auditoría) y CMP-06 (pruebas aparentes) de §19 de ENTREGA.md se incluyen en S01/S02/S14. CMP-01 del main del escritorio exige evitar esa base incompleta.

## 11. Decisiones que deben quedar concretas antes de ejecutar

| ID | Decisión | Recomendación para revisión | Bloquea |
|---|---|---|---|
| D-01 RESUELTA | Repositorio y base local | Base S00 inicial9980582; remoto elegido posteriormente por PO `eloisa-platform/Eloisa`. Checkpoint d1bf434 publicado en `feat/completar-modulos-reales`; main/develop intactas | Base y remoto fijados; no autoriza merge, producción ni cambios de permisos |
| D-02 | Actor institucional individual, relación a organización/capacidad y compatibilidad de cuentas anteriores | OIDC compartido para autenticación, autorización local por capacidad/institución; denegar legado sin aprobación hasta reconciliación explícita; conservar separación de guards/cookies donde el contrato la requiera | Paquetes de acceso institucional y acceso legado S01 |
| D-03 PARCIAL | TTL/idle por riesgo, MFA, recuperación y efecto de revocación | Recuperación administrada ya elegida e implementada en041; conservar sus controles y no exigir SMTP. Completar matriz de expiración/revocación del candidato y resolver pendientes por riesgo sin cambiar TTL/MFA implícitamente | Cierre S01 y pruebas053 |
| D-04 | Seed/test, realms/DB autorizados, cleanup y entrega segura | Dos tenants ficticios aislados; runId, contraseñas por cuenta, archivo local ignorado, reset conservador e idempotente | Provisión real del catálogo S01 |
| D-05 | Campos/reglas clínicas, institucionales, financieras/comerciales, fórmulas y retención aplicables | Especificar por dominio con fuentes autorizadas y aprobación del responsable; no copiar reglas del prototipo | Solo sección/flujo afectado |
| D-06 | Entorno de entrega, backup/RPO/RTO y alcance futuro con datos reales | Primero aceptación funcional con datos ficticios y pruebas reales; producción/datos reales/gateway mediante sus aprobaciones independientes | S14 y uso productivo |

Las recomendaciones no cambian silenciosamente documentos aprobados. En la base C hay decisiones posteriores sobre Keycloak local y portales; en A hay recomendaciones anteriores de Entra y otro estado de consentimiento. Deben reconciliarse con el Product Owner, sin tratar ambas como autorizaciones intercambiables.

## 12. Ejecución actual y siguiente paquete

S00 empezó el 8 de octubre en la base elegida. Se copiaron la auditoría histórica y este plan sin importar código de la otra historia. El bundle [039](../spec/specs/039-termino-s00-base-y-baseline/spec.md) documenta alcance y correcciones propuestas; S00-MP01 fue implementado/verificado por Codex tras autorización explícita de sustitución y conservación del consentimiento; aceptación PO pendiente. Los demás paquetes siguen pendientes. El [registro S00](plan-funcional/00-BASE-Y-BASELINE.md) contiene comandos y resultados actuales.

Tipos, builds API/web y validación Prisma pasan. La suite web falla en tres casos; lint tiene 17 errores y el escáner reporta 52 coincidencias que requieren clasificación. Las pruebas puras de baseline pasan 72/72. Los contratos API ejecutados pasan 656/656 tras corregir la configuración de prueba. Estos contratos no validan PostgreSQL/RLS real ni un login OIDC integrado.

S00-MP01 completó su implementación/verificación focal (lint 0, tipos/build API y 65 contratos correctos). Siguiente orden, tras aceptación y autorización del paquete: S00-MP02 regresiones web y retiro del atajo municipal conforme al objetivo sin demo; S00-MP03 clasificar/remediar escaneo sin debilitar reglas; S00-MP04 baseline aislada e imagen exacta bajo alcance aprobado. Después S01/ACC-01 a ACC-12, resolviendo D-02 a D-04 antes del paquete que dependa de ellas. No se han creado cuentas, contraseñas, sesiones ni consentimientos nuevos.

Actualización 2026-10-09: MP01 aceptado, MP02/MP03/MP04A guardados y verificados. MP04B aprobado por el PO, catálogo efectivo y preflight PostgreSQL real verificados (27 tablas/28 policies/17 migraciones). La baseline completa se detuvo en contratos API por falta de contexto confiable de tenant en entorno hijo; propuesta MP04C preparada para decisión material. Cleanup exclusivo verificado, sin tocar recursos compartidos. S00 completo y accesos S01 no aceptados. Los párrafos anteriores de ejecución conservan el diagnóstico inicial; el estado actual y el runbook incorporan las correcciones.

Actualización PO 2026-10-09: registro y operación deben ser reales; botones de usuarios test conservados con precarga de todos los datos y contraseña. MP05 verificado y servido en Docker (1901/1901 web); no prueba de login/E2E nueva. Propuesta MP06 concreta la procedencia de nuevas altas frente a TEST_DATA histórico; pendiente de decisión antes de migrar. MP04C y aceptación completa de accesos permanecen pendientes.
