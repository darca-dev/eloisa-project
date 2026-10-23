# Historia 055

## 2026-10-21 — propuesta y colaboración con Claude

- El Product Owner confirmó que también se permiten alarmas manuales y pidió trabajar con Claude para implementar el flujo revisado de bitácoras/criterios individuales/semáforo.
- Codex verificó el árbol limpio y volvió a leer la gobernanza, permisos y modelo relevantes. No se hicieron cambios de producción, migraciones, operaciones de base ni cambios Git.
- Se localizó Claude Code y se verificó autenticación por suscripción sin API key. Se inició una revisión de solo lectura del diseño y de sus decisiones pendientes; no se delegó implementación sin spec suficiente.
- Se creó la propuesta 055 con estados y gates explícitos, seis decisiones materiales, contrato mínimo, paquetes, pruebas y criterios observables. No se marcó aprobada ni se escribió consentimiento SDD.
- Pendiente: resultado de revisión Claude, aprobación de decisiones y contrato preciso de implementación. Las fases posteriores no se presentan como implementadas.
- El primer intento de revisión Claude falló por conexión (`ECONNREFUSED`) sin obtener revisión. El control automático rechazó el reintento por el envío externo de código/documentación interna. El Product Owner autorizó después expresamente compartir con Anthropic la spec y el código/documentación relacionados, excluyendo secretos, bases y datos reales; con esa autorización se reanudó únicamente la revisión de lectura. Esta autorización de transferencia no aprueba D01–D06 ni constituye consentimiento de implementación.
- Validación documental: gate global 0 errores/20 avisos (055 permanece pendiente); validación estricta 0 errores/0 avisos; diff-check y escaneo de secretos correctos. El estado global abierto corresponde a otras specs y no autoriza implementar 055.
- La propuesta preserva que el visitador competente decide sus parámetros sin imponer un segundo aprobador por defecto. También exige identidad estable de criterio entre versiones para no duplicar una alarma abierta al actualizar su configuración.
- Claude concluyó la revisión de lectura correctamente. Codex aceptó hallazgos sobre finalidad clínica del cuidador, competencia no acreditada por perfil, custodia/identidad institucional, riesgo de revocación concurrente, taxonomía/mensajes pendientes y adelanto parcial de S12. Se incorporaron explícitamente en spec/plan; D07 recoge la excepción de secuencia.
- Codex matizó dos generalizaciones de la revisión: la reserva administrativa única por experiencia no constituye un modelo general de institución, y existe una ruta de administrador identificado con auditoría humana. Eso no otorga permisos clínicos ni prueba que exista el revisor de alarmas propuesto.
- Resultado conjunto: 055 sigue pendiente y no es suficiente para implementación hasta cerrar decisiones y allowlist/contratos exactos. Informe específico en `spec/bitacora/handoffs/055-REVISION-CLAUDE-Y-CODEX.md`.
- Se preparó `contracts/DECISIONES-PRODUCT-OWNER.md` con alternativas, recomendaciones concretas y semántica temporal/episodios para revisión del Product Owner. No se presenta como aprobación ni como contrato clínico validado.
- Verificación final tras incorporar la revisión: validación SDD estricta 0 errores/0 avisos; escaneo de secretos correcto en 1315 archivos versionables; diff-check y revisión de whitespace de los siete documentos nuevos correctos. Solo hay cambios documentales de 055 e índice. No se ejecutaron pruebas de producto, migraciones, Git mutante ni despliegue.
- Posteriormente el Product Owner aprobó expresamente D01–D07. Se registró decisión canónica y el consentimiento específico derivado de ese acto; no se ejecutó confirm-user-consent.sh ni se extendió la autorización a Git/despliegue/datos reales.
- Codex cerró MP01-CUSTODIA-Y-PERMISOS.md: organizaciones explícitas, contexto de paciente, concesiones humanas adicionales, competencia declarada y política/auditoría en la misma transacción; allowlist y pruebas aisladas concretas. Pendiente ejecutar gates e implementar con Claude.
- Gate previo de implementación: abierto, 34 specs aprobadas/consentidas, 0 errores y 19 avisos históricos; validación estricta 0 errores/0 avisos. Se inició Claude MP01 con edición acotada por ruta y verificaciones permitidas; sin acceso a secretos, base real, Git mutante ni despliegue.
- La preparación de pruebas detectó catálogos exactos de tablas/policies en provision/preflight; el contrato amplía únicamente esos catálogos y sus expectativas, sin relajar guardas. También fija auditoría genérica sin FK ajena al denegar una organización no resoluble, preservando eventos históricos CAREGIVER.
- Codex preparó el contrato de integración MP02–03 mientras Claude trabaja en MP01; sigue cerrado hasta auditar su dependencia. No se presenta ningún paquete como terminado por haberse redactado su contrato.
- Revisión independiente posterior: el proceso delegado terminó informando conflicto con otra sesión; existe una entrega reconciliada posterior. Codex confirmó 41/41 pruebas unitarias y 45/45 del runner/catálogo, pero PostgreSQL aislado dio 25/26 (run-id baseline-20261021t225839, cleanup correcto). Falla la conservación de acceso tras salida del emisor manager. MP01 no se acepta todavía; hallazgos y límites en contracts/MP01-REVISION-CODEX.md. Las bitácoras y alarmas siguen pendientes.

## 2026-10-21 — auditoría de la entrega ampliada MP01–MP06

- El árbol posterior y el handoff consolidado de Claude incluyen bitácoras, manuales, criterios, motor, administración y recorrido de navegador. Las afirmaciones históricas de ausencia de esos paquetes describen el estado anterior, no el árbol auditado ahora.
- Codex y tres revisiones especializadas de solo lectura detectaron diez hallazgos: seis P1, tres P2 y uno P3. Dictamen y escenarios en `spec/bitacora/handoffs/055-AUDITORIA-CODEX.md`. No se aceptó el cierre funcional ni se cambió la decisión del PO sobre D01–D07/D04.5.
- Verificación independiente: 66/66 unitarias de cuidado, 49/49 del runner/catálogos/script, build API y lint focal correctos, scanner de secretos correcto, gate 0 errores/19 avisos históricos y SDD estricta 0/0. Baseline completa `codex055-audit`: 34/34 etapas, 2643 pruebas, 0 fallos/omisiones, provision y cleanup correctos; MP01 ahora 28/28 y catálogo FORCE RLS 6/6. El navegador/axe no se reejecutó por Codex. La batería verde no elimina los diez hallazgos adversos de la revisión.
- Codex actualizó únicamente documentación de revisión/estado; sin cambios de producción, Git mutante, base de aplicación, prototipo ni despliegue.

## 2026-10-22 — correcciones A01–A10

- El PO pidió corregir los hallazgos de 055. Codex concretó MP07A (datos/motor/elegibilidad) y MP07B (contexto web/entrada clínica/paginación/ajuste de criterios), con migración aditiva, tratamiento explícito de legado y pruebas adversas. D01–D07 y D04.5 se conservan.
- La revisión especializada de seguridad valida el enfoque de columnas nullable solo para legado y requisitos de inserción nuevos sin reescribir evidencia; se revisa expresamente la elegibilidad sin sesión del destinatario y el orden de locks antes del handoff.
- La autorización previa de transferencia a Claude para 055 sigue vigente; sin secretos, bases ni datos reales. No se autoriza Git/despliegue por este trabajo ni se ejecuta confirm-user-consent.sh.
- Claude entregó MP07A y corrigió las preparaciones de tiempo, concesión inválida y conjunto de contextos indicadas por Codex. Verificación independiente: API 39/39, fundación 37/37, FORCE RLS 6/6, unitarias 98/98 y runner/catálogos/script 49/49; migración real 29→30 preserva 12 filas de ocho tablas con duplicados históricos y guardas intactas. Tipos/build API informados por Claude, lint y Prisma validate verificados por Codex, gates 0 errores/19 avisos históricos y strict 0/0. MP07A apto como dependencia técnica de MP07B; no aceptación final ni Git/despliegue.

## 2026-10-23 — Revisión de cambios parciales de Claude

- El PO pidió revisar los cambios. La sesión MP07B quedó interrumpida por cuota tras 163 turnos, sin handoff final. Codex revisó el árbol sin modificar producción.
- Se documentan B01–B06 en `contracts/MP07B-REVISION-CODEX.md`: envíos rotos por firma de callback, borradores de otros formularios reiniciados, errores de tipos de navegador, paginación interactiva no cubierta, lint y HTTP 503 de paginación por transacción vencida.
- Verificación: web 127/127, API/OpenAPI 155/155; tipos web/API fallan con 20/3 errores y lint con uno. PostgreSQL aislado `baseline-20261023t154721`: fundación 37/37, FORCE RLS 6/6, API 42/43; provision/preflight/cleanup correctos, sin omitidas. Gates 0 errores/19 avisos históricos y strict 0/0. Navegador y baseline completa pendientes de corrección.
- MP07B y 055 permanecen sin cierre ni aceptación. Sin base de aplicación, Git mutante o despliegue.
- Repetida la API sola: `baseline-20261023t155027`, 42/43 y mismo 503 por transacción vencida, sin omitidas y con cleanup correcto. Escáner de secretos correcto en 1392 archivos versionables.

### Entrega posterior y revisión de la propuesta

- El PO pidió revisar la propuesta. Codex localizó `MP07B-FROM-CLAUDE.md` y verificó los cambios sin editar producción. La revisión especializada del nuevo camino de permisos no confirmó defecto de aislamiento; se conserva el límite de cobertura de concesiones distintas indicado en el informe.
- Verificación actual: tipos web/API y lint exit 0; web 127/127 y API/OpenAPI 169/169. PostgreSQL `baseline-20261023t181840`: fundación 37/37, FORCE RLS 6/6 y API 43/43, sin omitidas y con cleanup correcto. Se resolvió el 503 del caso B06 en este entorno.
- El recorrido real `baseline-20261023t182027` falla antes de lanzar Chromium: se crean dos administradores HOSPITAL con el mismo tenant/experiencia, prohibidos por la unicidad del modelo. B07/P2; 0 pruebas ejecutadas y 11 omitidas, exit 1. Provision/preflight/cleanup y cierre de servidores temporales propios correctos. No se presenta axe vacío como verificación. Sigue pendiente corregir fixture, navegador/axe, baseline y aceptación final.
- El PO ratificó «solo debe haber un admin de hospital». Codex registró `2026-10-23-055-admin-hospital-unico.md` y acotó B07 al fixture, manteniendo la unicidad y la separación de permisos clínicos. Sin cambios de producción ni ampliación del modelo administrativo.

### Continuación: B07–B10

- El PO pidió el siguiente paso. Al detectar la entrega B07 simultánea en el árbol, Codex detuvo su sesión duplicada de Claude antes de editar y auditó la existente. La secuencia mantiene un único administrador y revoca su concesión clínica por la API real. Chromium `baseline-20261023t203200`: 9/12, cero omitidas; pasa B07, se especifican B08/B09 para tres fallos restantes.
- Claude corrigió los selectores/sincronización y persistencia del conteo final dentro de las rutas acotadas. Chromium posterior `baseline-20261023t204020` pasa12/12, cero fallos/omisiones, con móvil, teclado, paginación completa y axe sin serias/críticas en vistas probadas; provision/preflight/cleanup correctos. Builds shared/API/web exit0, lint focal0 y runner49/49.
- Baseline `codex055-corrections` se detuvo en web1900/1902, después de provision/tipos/API51/51 correctos; cleanup correcto. B10 documenta la ampliación solo a dos pruebas consumidoras para imports y anuncios SSR conforme a055, sin nuevo código de producto ni permisos. Pendiente baseline completa y cierre técnico; Git y aceptación del PO siguen separados.
