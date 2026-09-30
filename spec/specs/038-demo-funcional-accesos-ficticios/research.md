# Investigación 038 — Demo funcional de registros y aprobaciones ficticias

## Método y fecha

Inspección de solo lectura realizada el 2026-09-24 sobre
`feat/041-central-access-approvals`, documentación autoritativa, specs vigentes,
código web/API, Prisma, OIDC local y validaciones disponibles. Incluye revisiones
independientes de seguridad/datos y arquitectura/pruebas.

## Hallazgos verificados

### Git y SDD

- Rama limpia en `530a722`; `develop` en `ad7a18c`.
- La rama está 11 commits por delante y contiene el historial de `develop`.
- La compuerta SDD abre con advertencias y la validación estricta termina sin
  errores; esos scripts no certifican correspondencia código–spec.

### Contradicciones

- 027: `spec.md`/`history.md` dicen `Borrador`; `INDEX.md`, `Aprobada`; no hay
  consentimiento 027 en el log SDD, pero existe implementación atribuida.
- 035: una cláusula da precedencia al demo sin persistencia, mientras requisitos
  posteriores describen una solución persistente.
- 037 verifica discovery e inicio OIDC, no el login completo ni el `sub` real.

### Acceso central y rutas

- `/acceso` monta `DemoNavigation`; `CentralAccess` está desconectado.
- La prueba actual consolida el bypass directo y no prueba el acceso central.
- `/hospital` y `/municipality` inyectan contexto demo. El fallo municipal
  identifica una desviación real respecto de la puerta de sesión aprobada.

### Identidad y persistencia

- Existen `Tenant`, `Person`, `Patient`, `HumanAccount`, identidad/sesión OIDC,
  perfil/afiliación/asignación profesional y relación Cuidador–Paciente.
- `CAREGIVER` requiere relación activa. `PROFESSIONAL` no concede pacientes sin
  afiliación/asignación. Aprobar identidad no sustituye esas autorizaciones.
- No existe `AccessRequest` ni API persistente; la bandeja Hospital es React.
- `InstitutionalIdentity` es una credencial opaca y no atribuye una decisión a
  una persona trabajadora.

### Defectos de provisión 027

- El formulario conserva password pero el request builder no lo envía. Este
  campo no puede reutilizarse: introduciría una credencial en el camino hacia
  un sistema MERDN que la spec 038 prohíbe almacenar.
- Se persiste un subject pregenerado y se ignora el identificador real devuelto
  por Keycloak.
- La base confirma antes de crear usuario externo; un fallo deja cuenta parcial.
- El log puede incluir username y el retry puede reiniciar su contador.
- El E2E depende de otra prueba, usa `|| true`, no ejecuta axe y no comprueba
  `sub`, revocación de enrollment session ni auditoría completa.

### Disposición de cuarentena documental — provisión 027

Registro de la auditoría T00.9 como aplicable. El flujo de provisión atribuido a
la spec 027 queda en cuarentena documental: no puede reutilizarse ni adaptarse
como parte de 038 y no se realiza ningún rediseño de identidad dentro de
MP00-C1. La provisión nueva se implementará dentro de MP04 según `plan.md`.

Quedan prohibidos en el nuevo flujo:

- `password`: nunca se envía ni persiste en MERDN (OD-03, OD-11); se elimina por
  completo del DTO, la validación y la auditoría.
- `sub` pregenerado: no se inventa un identificador de identidad; se persiste el
  `sub` real devuelto por Keycloak antes de declarar `APPROVED`.
- Commit antes del IdP: no se confirma la transacción de base antes de crear el
  usuario externo; si el proveedor falla no puede quedar una cuenta parcial
  `APPROVED` utilizable.
- Logs con username: la auditoría y los logs no registran username, nombre,
  documento, correo, teléfono ni otro dato personal (ver `spec.md` §6.4-6.5).
- Retry defectuoso: el reintento será limitado, idempotente y reiniciable sin
  perder trazabilidad ni duplicar provisiones.

Tratamiento de la implementación existente: el código de provisión 027 queda
intacto y fuera de alcance de MP00-C1; ninguna ruta, componente o plan de 038 lo
invoca. No constituye línea base para MP04.

### Pruebas y build

- Build completo exitoso.
- Suite web: 1.693/1.700; siete fallos en branding, pestañas Hospital, allowlist
  de red, reloj Dashboard, conteos de navegación/SVG y sesión demo municipal.
- Seis fallos parecen expectativas frágiles u obsoletas; el municipal muestra
  una desviación. No deben resolverse ampliando allowlists indiscriminadamente.

### Operación demo

- Hay fixtures visuales, pero no `demo:reset`, seed integral ni runbook.
- Los comandos descritos por análisis externos eran propuestas, no estado real.

## Alternativas evaluadas

### A. Estado en memoria o `localStorage`

No satisface servidor, tenant, auditoría ni recuperación. Descartada.

### B. Solicitud persistente + OIDC local + permisos separados

Reutiliza sesiones y límites existentes y permite evidencia verificable.
Requiere migración, capacidad revisora, API y provisión coordinada. Recomendada
para tenant/realm/base demo.

### C. Crear relación/asignación al aprobar

Acorta el guion, pero confunde identidad con autorización sobre pacientes.
Descartada. Relación/asignación deben ser acciones separadas.

### D. Provisión externa dentro de transacción PostgreSQL

No existe atomicidad real entre almacenes. Descartada. Se requiere estado
explícito con reintento idempotente o compensación.

## Conclusión

El incremento coherente es una vertical persistente limitada al demo, con
capacidad revisora exacta y autorizaciones separadas. La línea base, 027/035 y
los defectos de provisión deben resolverse antes de código.

## Evidencia MP00-C2 — PostgreSQL no aislado

La ejecución del 2026-09-26 confirmó que el contenedor local de PostgreSQL y las
13 migraciones existentes funcionan, pero también confirmó que `merdn_dev` no
puede emplearse como baseline de pruebas:

- la base era persistente, contenía tres tenants y pertenecía al entorno local
  de desarrollo;
- la suite API sí alcanzó PostgreSQL y terminó con 15 archivos fallidos, 38
  exitosos, 35 pruebas fallidas, 769 exitosas y 219 omitidas;
- los fallos incluyeron contaminación entre pruebas, sesiones preexistentes y
  estado de rol/conexión incompatible con una corrida desechable;
- por ello, el resultado no demuestra defectos equivalentes del producto ni una
  línea base verde y no autoriza MP01 de la spec 038.

La infraestructura correcta ya está definida y aprobada en la spec 025:
proyecto Compose `merdn-baseline-test`, servicio `postgres-test`, base
`merdn_test`, puerto `55432`, red y volumen exclusivos, guardas anti-entorno,
migraciones reales, runtime enforce, runner con cero skips y cleanup verificado.
Los artefactos previstos por 025 aún no existen en el árbol actual. La spec 038
no debe improvisar una segunda infraestructura ni ejecutar sus pruebas contra
`merdn_dev`; debe consumir la baseline aislada una vez materializada conforme a
025 o mediante una reconciliación explícita aprobada.
