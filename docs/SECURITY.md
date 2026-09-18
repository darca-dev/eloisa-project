# MERDN — Arquitectura de seguridad y privacidad

## 1. Propósito, autoridad y alcance

Este documento define la línea base de seguridad de MERDN para diseño, implementación, pruebas y operación. Complementa `AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT.md`, `docs/MODULES.md`, `docs/ROLES.md`, `docs/DATA.md` y `docs/ARCHITECTURE.md`.

No interpreta ni inventa requisitos legales o regulatorios. Las bases jurídicas, periodos de retención, residencia, notificación obligatoria, firma, valor probatorio y requisitos sectoriales exactos permanecen sujetos a revisión y aprobación especializadas.

Principios obligatorios:

1. denegación por defecto;
2. mínimo privilegio y separación de funciones;
3. aislamiento de tenant y organización;
4. defensa en profundidad;
5. minimización y finalidad;
6. procedencia e integridad;
7. auditoría append-only conceptual;
8. protección por sensibilidad, no por pantalla;
9. fallar cerrado en decisiones de acceso;
10. ningún administrador técnico tiene acceso implícito al negocio.

### 1.1 Infraestructura activa del MVP

**APROBADO:** el MVP se ejecuta en Hostinger VPS KVM 4 en Brasil mediante Docker Compose. PostgreSQL y el almacenamiento documental persistente controlado viven en el VPS y no exponen puertos públicos. El almacenamiento se consume mediante una abstracción sustituible; la seguridad no puede depender de Azure Blob ni de otro proveedor concreto.

Azure no es infraestructura activa del MVP. Solo puede evaluarse como alternativa futura de producción cuando requisitos de seguridad, cumplimiento, disponibilidad o escalabilidad lo justifiquen y exista aprobación separada.

## 2. Modelo de amenazas resumido

Activos prioritarios:

- identidad, cuentas, relaciones, consentimientos y asignaciones;
- datos personales, clínicos, operativos y territoriales;
- presupuesto, gasto, contratos y pagos controlados;
- documentos, evidencia, indicadores y Hub regulatorio;
- auditoría, exportaciones, backups, secretos e integraciones.

Amenazas principales:

- acceso entre tenants, instituciones, programas o pacientes;
- abuso de identificadores directos y consultas sin scope;
- escalamiento de rol o acumulación de funciones incompatibles;
- acceso clínico por Alcaldía, Finanzas, soporte o administración;
- cuidador o profesional con relación/asignación vencida;
- archivos maliciosos, enlaces públicos o evidencia sustituida;
- exportación masiva y reidentificación de agregados pequeños;
- manipulación o borrado de auditoría;
- mezcla de procedencias u oficialidad falsa;
- secretos o datos sensibles en código, logs, errores o telemetría;
- integraciones comprometidas, replays y webhooks falsificados;
- pérdida, corrupción, ransomware o restauración incompleta.

## 3. Responsabilidades de seguridad

| Sujeto | Responsabilidad | Prohibición |
| --- | --- | --- |
| Product Owner | aprobar alcance, riesgo y decisiones materiales | no sustituye revisión técnica/especializada |
| Codex | arquitectura, especificación y auditoría | no declara implementación no verificada |
| Claude Code | implementar Task Specification y pruebas | no decide permisos, clínica, regulación o tenancy por inferencia |
| Institución/tenant | usuarios, afiliaciones, finalidades y dueños de datos | no obtiene acceso a otros tenants |
| Administrador institucional | administración delegada | sin clínica/finanzas implícitas |
| Administrador de plataforma | configuración técnica | sin acceso universal a contenido de negocio |
| Operador técnico | soporte/integración/auditoría técnica limitada | sin suplantación ni contenido por defecto |
| Auditor | consulta trazabilidad autorizada | no modifica objeto ni eventos auditados |

## 4. Autenticación

### 4.1 Recomendación

Microsoft Entra External ID mediante OpenID Connect/OAuth 2.0. MERDN confía en tokens validados y mantiene localmente la persona, perfiles, afiliaciones, relaciones, roles y contexto; no almacena contraseñas.

### 4.2 Controles

- Authorization Code Flow con PKCE para navegador.
- Validar firma, issuer, audience, expiración, `not before` y algoritmo permitido.
- Rotación y caché segura de JWKS; rechazo cerrado si no puede validarse.
- Tokens no se aceptan por query string.
- El identificador del proveedor se vincula a cuenta dentro del tenant; no concede perfil ni institución automáticamente.
- MFA obligatorio para administradores, finanzas/aprobaciones, cumplimiento, auditoría y operaciones técnicas; alcance final antes de PROD.
- Recuperación de cuenta, cambio de método, bloqueo y desvinculación son auditables.
- Identidades máquina-a-máquina separadas por integración y mínimo alcance.
- No se implementa autenticación casera ni almacenamiento de passwords.

### 4.3 Riesgo y alternativa

**Riesgo:** dependencia del proveedor, mala federación o claims sobreconfiados. Mitigación: adapter OIDC, autorización local, claims mínimos y pruebas de issuer/audience.

**Alternativa:** Auth0 administrado o Keycloak operado por MERDN. Keycloak añade carga operativa; Auth0 mantiene dependencia comercial similar.

## 5. Sesiones y contexto activo

- Cookies de sesión web `Secure`, `HttpOnly` y `SameSite=Lax` o más restrictivo según flujo.
- Tokens se mantienen en backend/session layer cuando sea posible, no en `localStorage`.
- Protección CSRF en operaciones autenticadas por cookie.
- Rotación de sesión tras login, elevación, recuperación o cambio sensible.
- Timeout de inactividad y vida máxima diferenciados por riesgo: valores **POR DEFINIR antes de PROD**.
- Logout invalida sesión MERDN; revocaciones críticas deben surtir efecto sin esperar vencimiento largo del token.
- Cada operación institucional tiene tenant y organización activa; programa/finalidad cuando apliquen.
- Cambio de contexto invalida cachés, cursores, selecciones y autorizaciones anteriores.
- Sesiones concurrentes y dispositivos se muestran/revocan cuando el proveedor y alcance lo permitan.
- El contexto recibido del navegador se valida; nunca es una fuente de autoridad.

## 6. Autorización

### 6.1 Decisión

Autorización contextual centralizada:

```text
cuenta activa
AND tenant permitido
AND persona/perfil vigente
AND afiliación vigente
AND rol permite acción
AND institución/organización activa coincide
AND programa permitido cuando aplica
AND relación válida cuando aplica
AND asignación válida cuando aplica
AND finalidad compatible
AND consentimiento/autorización cuando aplica
AND vigencia válida
AND sensibilidad permitida
AND ausencia de prohibición explícita
```

### 6.2 Reglas

- UI nunca constituye autorización.
- Controllers no implementan reglas ad hoc; llaman al policy service.
- Cada política produce permitir/denegar y razón interna estable.
- Denegación no revela si existe un recurso de otro ámbito.
- Ver, crear, editar, aprobar, asignar, cerrar, archivar, descargar, imprimir, exportar y auditar son permisos distintos.
- Acceso a agregados no permite drill-down nominal.
- Roles se recalculan por contexto; no se suman globalmente entre instituciones.
- Revocación, suspensión, expiración o baja impiden uso futuro y conservan historia.
- Pruebas negativas son obligatorias para cada endpoint sensible.

## 7. Tenant isolation

### 7.1 Frontera

Tenant lógico por cliente o despliegue. Una persona es única dentro de su tenant. No existe acceso cruzado implícito ni identidad global compartida.

### 7.2 Controles de aplicación y datos

1. Tenant se resuelve desde cuenta/afiliación autorizada, no desde un header confiado.
2. Toda entidad de negocio aislada porta `tenant_id` no nulo.
3. Relaciones y claves únicas incluyen tenant cuando corresponda.
4. Foreign keys/constraints impiden asociaciones cruzadas.
5. Repositorios exigen contexto y aplican tenant explícito.
6. PostgreSQL RLS deniega filas de otro tenant como segunda barrera.
7. Rol runtime no es owner, superuser ni `BYPASSRLS`.
8. Contexto de RLS se fija con alcance transaccional para evitar contaminación del pool.
9. Jobs, exports, búsquedas, indicadores, archivos e integraciones llevan tenant explícito.
10. Backups/restores y soporte preservan la frontera y se prueban.

### 7.3 Pruebas mínimas

- Dos tenants ficticios con IDs coincidentes en recursos secundarios.
- Lectura, escritura, actualización, búsqueda, relación, exportación y job cruzados deben fallar.
- Cambio de organización/programa no reutiliza resultados previos.
- Conexiones reutilizadas no heredan contexto RLS.
- Administrador de plataforma no puede leer contenido de negocio.

## 8. Mínimo privilegio y separación de funciones

- Identidades diferentes para runtime, migraciones, backup, monitoreo e integración.
- Runtime solo permisos requeridos; migrator no atiende tráfico.
- Creador y aprobador se separan para gastos, contratos, evidencia, interpretación y publicación cuando el flujo lo requiera.
- Auditor no edita el objeto auditado.
- R13 no se asigna privilegios propios sin aprobación.
- R14/R15 no se combinan automáticamente con roles de negocio.
- Soporte, auditoría técnica e integraciones son subfunciones separadas.
- Privilegios temporales tienen solicitante, aprobador independiente, motivo, scope y expiración.
- Revisiones periódicas de acceso y frecuencia exacta: **POR DEFINIR antes de PROD**.
- Impersonation y break-glass permanecen no aprobados para MVP.

## 9. Protección de datos

### 9.1 Clasificación

Se aplican las clases de `DATA.md`: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `SENSITIVE_PERSONAL`, `CLINICAL`, `FINANCIAL`, `REGULATORY` y `AUDIT_RESTRICTED`.

### 9.2 Controles generales

- TLS para tráfico externo e interno gestionado.
- Cifrado en reposo verificable para DB, almacenamiento documental, backups y logs; en el VPS debe configurarse y validarse expresamente.
- Cifrado de aplicación/campo solo cuando el análisis de riesgo lo justifique; no crear criptografía propia.
- Minimización en modelos, respuestas, eventos, logs y analytics.
- Datos ficticios/desidentificados en DEV/TEST; no clonar PROD.
- Identificadores opacos en API; no confiar en opacidad como autorización.
- Cachés privadas, con claves que incluyan tenant/contexto y sin compartir respuestas sensibles.
- Cabeceras CSP, HSTS, anti-clickjacking, `nosniff`, Referrer Policy y Permissions Policy ajustadas.
- CORS allowlist exacta por entorno; no comodín con credenciales.
- Rate limiting por cuenta, IP/cliente e integración, con cuidado de no bloquear indebidamente flujos críticos.
- Retención, anonimización y disposición según clase; periodos exactos POR DEFINIR.

## 10. Datos clínicos

- La información clínica formal proviene de fuente hospitalaria autorizada y conserva institución, fecha original, recepción, versión, importación y fuente.
- MERDN no reemplaza HCE ni modifica automáticamente prescripciones o registros externos.
- Datos operativos declarados o profesionales no se mezclan con clínica importada.
- Paciente accede a información propia autorizada.
- Cuidador requiere relación específica, alcance, institución, finalidad y vigencia.
- Profesional requiere afiliación, asignación, programa/servicio, finalidad y vigencia.
- Alcaldía, Finanzas, liderazgo, administración y soporte: denegado por defecto.
- Vista, descarga, impresión y exportación clínica son acciones separadas y auditadas.
- Discrepancias crean revisión; no sobrescriben la fuente.
- Dataset exacto, terminología, retención, emergencia y write-back siguen POR DEFINIR; no se inventan.

## 11. Datos financieros y comerciales

- MERDN registra fuente de recurso, presupuesto, asignación, gasto, soporte, proveedor y ejecución, sin contabilidad oficial.
- Crear, aprobar, ajustar, pagar/reconciliar y auditar son funciones separables.
- Finanzas no obtiene acceso clínico.
- Referencias nominales se minimizan y requieren finalidad aprobada.
- Soportes financieros no deben incluir clínica innecesaria.
- Servicios financiados institucionalmente y servicios comerciales mantienen contextos distintos.
- Cita no equivale a servicio prestado, gasto ejecutado ni ingreso.
- Cobro/pago/ingreso requiere prestación y evidencia según reglas aprobadas.
- MVP no procesa pagos; solo referencias/estados controlados.
- MERDN no almacena PAN completo, CVV, credenciales bancarias ni secretos de gateway.
- Si se aprueba gateway, se usa tokenización del proveedor, webhook firmado, idempotencia y reconciliación; habrá evaluación de alcance independiente.

## 12. Documentos y evidencias

### 12.1 Metadatos obligatorios

Cada evidencia conserva origen, autor, fecha, versión, institución, tenant, relaciones, sensibilidad, estado y trazabilidad. Cada archivo conserva tipo detectado, tamaño, checksum y referencia de almacenamiento.

### 12.2 Controles

- Storage privado; acceso público deshabilitado.
- Carga a cuarentena con límite de tamaño y allowlist de tipos necesarios.
- Verificar tipo real/magic bytes; no confiar en extensión o Content-Type.
- Análisis antimalware antes de disponibilidad.
- Nombres opacos y sin segmentos aportados por usuario.
- URLs firmadas de mínima duración, scope de objeto y acción; nunca en logs.
- Descarga exige autorización actual, aunque el usuario conserve una URL anterior.
- Vista previa se sirve en sandbox/aislamiento y con headers seguros.
- Versionar en vez de reemplazar; preservar checksum y relación previa.
- Enlaces evidencia-objeto respetan la sensibilidad más restrictiva.
- Carga, lectura, descarga, versión, relación, aprobación, exportación, archivo y disposición se auditan.
- Eliminación de blob y metadatos se coordina mediante flujo idempotente y reconciliable.

Integridad avanzada, firma digital y valor probatorio exacto quedan POR DEFINIR; no se afirman capacidades no implementadas.

## 13. Auditoría append-only

### 13.1 Propiedades

- Eventos creados por el sistema, nunca editados o borrados por usuarios normales.
- Rol runtime sin UPDATE/DELETE sobre eventos.
- Evento material en la misma transacción del cambio cuando sea posible.
- Actor real, tenant, organización, contexto, acción, recurso, identificador, resultado, timestamp UTC, correlación y fuente técnica.
- Valores anterior/nuevo solo si son necesarios y minimizados; no copiar secretos o documentos.
- Acceso y exportación de auditoría también se auditan.
- Desactivación de usuario no elimina autoría.
- Fallo al registrar auditoría material hace fallar cerrado la operación cuando la especificación lo determine.

### 13.2 Protección y revisión

- Identidad DB separada para migraciones/disposición excepcional.
- Alertar intentos de UPDATE/DELETE o discontinuidades.
- Backup y restauración incluyen auditoría.
- Exportación futura a almacenamiento WORM puede añadirse si riesgo o política lo exigen.
- Retención, particionamiento, criptografía de integridad e inmutabilidad externa exactos: POR DEFINIR antes de PROD.

Append-only conceptual no equivale a afirmar inmutabilidad criptográfica o legal no implementada.

## 14. Exportaciones y reportes

- Exportar es permiso independiente.
- Solicitud incluye tenant, organización, finalidad, filtros, campos, periodo y nivel de agregación.
- Reautorizar al generar y descargar; jobs no heredan ciegamente permisos antiguos.
- Archivos cifrados en tránsito/reposo, con URL corta, expiración y eliminación controlada.
- Registrar solicitante, alcance, conteo, resultado y descargas.
- Limitar volumen, frecuencia y concurrencia; exports grandes son asíncronos.
- Evitar CSV injection y fórmulas activas; sanear celdas exportadas.
- No incluir campos ocultos por UI ni metadatos internos.
- Alcaldía recibe agregados por defecto; nominal requiere autorización/finalidad explícita y auditoría.
- Umbrales de grupos pequeños y reglas de reidentificación: POR DEFINIR antes de reportes reales.

## 15. Acceso municipal

- Scope por tenant, municipio, institución/relación autorizada, programa, finalidad y periodo.
- Población, cobertura, territorio, servicio, recursos, evidencia, Hub e indicadores son agregados por defecto.
- No existe acceso clínico individual por pertenecer a Alcaldía o Secretaría.
- Acceso nominal requiere caso aprobado, campos mínimos, base/finalidad explícita, vigencia, permiso y auditoría.
- Dirección exacta, relaciones, evidencia identificable, listados masivos y drill-down requieren autorización adicional.
- Filtros y exports aplican controles de grupos pequeños.
- Usuarios municipales que también son pacientes usan contexto de paciente para sus datos propios.

## 16. Secrets y criptografía

- En el Hostinger MVP, secretos en archivos root-only fuera del repositorio o mecanismo Docker equivalente, con valores separados y rotación gobernada; nunca dentro de la imagen o Compose versionado.
- Un secret manager administrado puede evaluarse en una infraestructura futura; no forma parte del stack activo del MVP.
- Nunca en Git, imágenes, documentación, fixtures, variables frontend, logs o mensajes de error.
- Configuración no sensible puede estar versionada; secretos se inyectan por entorno.
- Secretos separados DEV/TEST/PROD y por integración.
- Rotación documentada, auditada y probada; frecuencia según riesgo POR DEFINIR.
- Certificados/keys con mínimo scope y expiración; preferir identidades administradas sobre client secrets.
- Escaneo de secretos en pre-commit/CI y repositorio.
- Si un secreto se expone, revocar/rotar inmediatamente; borrarlo de Git no basta.
- Algoritmos y TLS administrados por bibliotecas/plataforma soportadas; no criptografía propia.

## 17. Logs, monitoreo e incident logging

### 17.1 Logging seguro

Permitido: servicio, entorno, severidad, operación, duración, resultado, códigos de error, request/correlation ID y referencias seudonimizadas necesarias.

Prohibido: contraseñas, tokens, cookies, secretos, URLs firmadas, contenido clínico, documentos, PAN/CVV, cuerpos completos, datos personales innecesarios o valores before/after indiscriminados.

Redacción centralizada y pruebas automáticas verifican que datos sensibles no aparezcan. Errores al cliente son seguros; detalles internos solo en telemetría protegida.

### 17.2 Monitoreo

- picos de 401/403, denegaciones cruzadas y cambios privilegiados;
- fallos RLS o consultas sin contexto;
- descargas/exportaciones anómalas;
- errores y malware documental;
- manipulación intentada de auditoría;
- fallos/replays de integración;
- outbox estancado;
- salud de DB, almacenamiento, backups y restauraciones;
- vulnerabilidades/dependencias e imágenes.

### 17.3 Registro de incidentes

Un incidente de seguridad se registra separado del log técnico con:

- identificador y timestamps;
- detector y clasificación preliminar no regulatoria;
- tenants/sistemas potencialmente afectados sin divulgar datos innecesarios;
- evidencias preservadas y cadena de manejo interna;
- acciones de contención, erradicación y recuperación;
- responsables, decisiones, comunicaciones aprobadas y cierre;
- vínculo a auditoría y postmortem.

Se preservan logs/evidencias relevantes con acceso restringido. Criterios legales de notificación, severidades oficiales y plazos no se inventan y quedan POR DEFINIR por responsables autorizados.

## 18. Backups y recuperación

- PostgreSQL en producción: backups automáticos y, cuando la modalidad lo soporte, WAL/PITR y cifrado administrado; en VPS debe implementarse y probarse una capacidad equivalente o documentarse la brecha.
- Almacenamiento documental: versionado/soft delete y redundancia según decisión de riesgo.
- En el Hostinger MVP se contrata backup diario del VPS y además se genera backup lógico cifrado de PostgreSQL/documentos hacia un destino externo independiente.
- El backup semanal predeterminado de Hostinger y su snapshot manual de corta vida no bastan por sí solos para producción; el snapshot se usa como checkpoint, no como estrategia de continuidad.
- Se valida que las copias externas no dependan de la supervivencia ni de las credenciales runtime del mismo VPS.
- Separar permisos de backup/restore de administración ordinaria.
- Proteger backups contra borrado por compromiso del runtime.
- No usar backups de PROD en DEV/TEST.
- Pruebas periódicas de restauración en entorno aislado.
- Después de restaurar: validar tenant isolation, RLS, auditoría, documentos, checksums, outbox, identidad y secretos.
- Registrar y auditar restauraciones y accesos.
- RPO, RTO, retención, geo-redundancia y destrucción final POR DEFINIR antes de PROD.

## 19. Acceso administrativo y soporte

- Consolas cloud y DB requieren identidad individual, MFA y roles mínimos.
- Sin cuentas compartidas.
- Acceso a PROD temporal cuando sea viable, aprobado y auditado.
- Administración de plataforma no concede clínica, finanzas, contratos, Hub ni documentos.
- Soporte opera con metadatos técnicos por defecto.
- Acceso excepcional a contenido no está aprobado para MVP.
- No impersonation.
- Operaciones directas en DB de PROD se prohíben como práctica normal; cualquier excepción exige incidente/cambio autorizado, doble revisión y evidencia.
- En Hostinger, deshabilitar login SSH root ordinario, usar claves individuales, allowlist/firewall y usuario de despliegue; hPanel y cuenta de dominio requieren MFA.
- Logs de administración cloud se centralizan y retienen según política POR DEFINIR.
- Baja de personal revoca accesos, sesiones, claves y membresías sin borrar autoría.

## 20. Integraciones

### 20.1 Requisitos comunes

- Dueño funcional, institución, finalidad, base/autorización, campos, sensibilidad, frecuencia y retención definidos.
- Cuenta técnica por integración y entorno; mínimo privilegio.
- TLS y autenticación robusta; allowlist/red privada cuando aplique.
- Credenciales en Key Vault y rotación.
- Mapeo/versionado y procedencia por ejecución/registro.
- Validación de esquema, tamaño y contenido antes de incorporar.
- Idempotencia, anti-replay, timestamps/nonces cuando aplique.
- Cuarentena de errores; reconciliación y reintento controlado.
- Importado no significa válido, oficial o clínicamente autoritativo.
- Exportación minimizada y auditada.
- Desactivar integración revoca credenciales y detiene jobs.

### 20.2 Webhooks

- Verificación criptográfica con secreto/certificado del proveedor.
- Validar timestamp y ventana anti-replay.
- Persistir identificador idempotente antes de efectos.
- Responder rápido y procesar por outbox/worker.
- No confiar en IP como único control.
- No registrar payload sensible completo.

## 21. Seguridad del SDLC y dependencias

- Branch protegida y revisión humana para cambios de seguridad, migración y permisos.
- Lockfile obligatorio y builds reproducibles.
- Dependencias mínimas, inventario/SBOM y actualización controlada.
- SAST, dependency scan, secret scan e image scan en CI.
- DAST y pentest antes de PROD y después de cambios materiales de riesgo.
- Linters/typecheck no sustituyen pruebas de autorización.
- Migraciones revisadas por pérdida, constraints, tenant, RLS y rollback/forward fix.
- Datos de prueba ficticios; factories crean al menos dos tenants.
- Hallazgos se clasifican, asignan, corrigen y verifican antes de aceptación según riesgo.
- No desplegar con pruebas relevantes fallando o vulnerabilidades críticas conocidas sin decisión explícita documentada.

## 22. Requisitos de seguridad por Task Specification

Cada tarea significativa debe indicar:

1. datos, propietario, tenant y sensibilidad;
2. actores, acciones, finalidad y política;
3. relaciones/asignaciones/vigencia;
4. eventos de auditoría y minimización;
5. procedencia y corrección;
6. inputs, outputs y validación;
7. archivos/integraciones y modos de falla;
8. amenazas y controles;
9. pruebas positivas y negativas;
10. pruebas de tenant isolation;
11. retención/archivo/disposición aplicables;
12. evidencia que Claude Code devolverá a Codex.

## 23. Gates mínimos antes de PROD

No bloquean el inicio del desarrollo, pero sí el uso de datos reales:

- región, residencia y dueño de suscripciones aprobados;
- configuración Entra, MFA, recuperación y acceso privilegiado aprobados;
- catálogo de datos y permisos del vertical slice cerrado;
- RPO/RTO, backups, restauración y retención definidos/probados;
- WAF, TLS, dominios, CORS/CSP y rate limits configurados;
- RLS y pruebas de dos tenants aprobadas;
- antimalware y flujo documental verificados;
- auditoría, monitoreo, alertas e incident runbook operativos;
- revisión de privacidad/seguridad y pentest según riesgo;
- integraciones y proveedores contractualmente/técnicamente aprobados;
- rollback y continuidad ensayados.

### 23.1 Evaluación obligatoria de Hostinger

Hostinger KVM 4 en Brasil queda **APROBADO** como infraestructura activa del MVP con datos ficticios o controlados. Esta aprobación no autoriza automáticamente información clínica o datos reales.

Antes de promover una arquitectura Hostinger a producción deben quedar documentados y verificados:

1. plan y recursos exactos, ubicación del centro de datos y responsabilidades del VPS autogestionado;
2. hardening del sistema operativo, parcheo, firewall, SSH, MFA y escaneo;
3. aislamiento de red, contenedores, PostgreSQL, almacenamiento y tenants;
4. cifrado en tránsito y en reposo verificable, incluyendo backups;
5. backup diario independiente, retención, integridad y restauración completa probada;
6. RPO/RTO, pérdida total del VPS y recuperación en infraestructura nueva;
7. monitoreo de aplicación/seguridad, alertas y uptime externos al VPS;
8. logs e incident logging protegidos fuera del punto único de falla cuando el riesgo lo exija;
9. control de acceso administrativo y evidencia de acciones privilegiadas;
10. residencia, transferencias, tratamiento contractual y uso de datos aprobados;
11. controles de clínica, documentos, evidencia, auditoría y exportaciones;
12. pruebas de carga, capacidad de disco, crecimiento y disponibilidad;
13. aceptación explícita del riesgo de punto único de falla o separación de componentes críticos;
14. plan de migración a servicios administrados si los gates no pueden cumplirse.

Si cualquiera de estos puntos materiales no puede demostrarse, los datos reales no se alojan en esa modalidad. Esto no descarta Hostinger: limita su uso al nivel de riesgo efectivamente validado.

## 24. Bloqueos para comenzar a programar

**No existen bloqueos de seguridad que impidan comenzar la base técnica.**

Se puede implementar inmediatamente scaffolding, separación de entornos, tenant/contexto, OIDC adaptable, policy service, RLS, auditoría, procedencia, outbox, almacenamiento en cuarentena y pruebas de aislamiento con datos ficticios.

Los detalles marcados POR DEFINIR bloquean únicamente la activación del flujo afectado o el uso de datos reales; Claude Code debe detener esa parte si una Task Specification intenta implementarla sin decisión aprobada.
