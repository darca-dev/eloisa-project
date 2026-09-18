# Prisma — esquema, migraciones y verificación de PostgreSQL

## 1. Alcance

TASK-001 dejó `prisma/schema.prisma` con **solo** `datasource` y `generator`, sin
modelos ni migraciones.

**TASK-MVP-CORE-01** incorpora la primera migración de negocio autorizada: la
cadena mínima «Inscripción → Paciente persistente» de la rama Paciente.

Modelos declarados:

| Modelo | Propósito |
| --- | --- |
| `Tenant` | Tenant institucional lógico. CORE-01 resuelve uno solo, server-side. |
| `Person` | Identidad mínima por tenant. **No** almacena la edad. |
| `Patient` | Perfil de paciente, EPS controlada, origen y estado. |
| `PatientPopulationMembership` | Pertenencias poblacionales no excluyentes (1..3). |
| `TerritorialUnit` | Jerarquía territorial: departamento, municipio, barrio, vereda. |
| `PatientAddress` | Territorio canónico + dirección exacta sensible, separados. |
| `ConsentRecord` | Consentimiento versionado con fecha asignada por el servidor. |
| `EnrollmentSession` | Credencial de recuperación. Solo el **hash** del token. |
| `AuditEvent` | Evento mínimo append-only de creación de inscripción. |

Fuera de alcance y por tanto ausentes: cuidador, profesional, agenda, hospital,
alcaldía, programas, evidencias, finanzas, FURAG/MIPG, ADRES, SENA, indicadores,
integraciones y autenticación completa.

## 2. Configuración

| Archivo | Contenido |
| --- | --- |
| `prisma/schema.prisma` | `datasource`, `generator` y los modelos de CORE-01 |
| `prisma.config.ts` (raíz) | `schema`, `datasource.url = env('DATABASE_URL')` y carga de `.env` |

En **Prisma 7** la cadena de conexión ya no se declara en el esquema: se
resuelve en `prisma.config.ts`. La función `env()` de Prisma falla con un error
explícito si `DATABASE_URL` no está definida, y nunca imprime su valor.

Prisma 7 tampoco carga `.env` automáticamente; `prisma.config.ts` lo hace con
`import 'dotenv/config'`.

### Cliente Prisma

El bloque `generator` produce el cliente en `apps/api/src/generated/prisma`, ruta
ignorada por Git. **Debe generarse antes de compilar o probar la API**:

```bash
npx prisma generate
```

Prisma 7 no incluye motor de consulta binario: el cliente requiere un adaptador
de controlador. La API usa `@prisma/adapter-pg` sobre `pg`, declarados como
dependencias de `apps/api`.

## 3. Migraciones

```text
prisma/migrations/
├── 20260821120000_core_01_init/migration.sql            # esquema
├── 20260821120100_core_01_reference_data/migration.sql  # tenant + DIVIPOLA
├── 20260822120000_core_01_hardening/migration.sql       # endurecimiento
└── ROLLBACK-core_01.sql                                 # rollback documentado
```

Las tres migraciones son **aditivas**: crean objetos nuevos o endurecen los
existentes, no borran datos y no tocan volúmenes. Antes de CORE-01 el esquema
`public` no contenía ninguna tabla de negocio.

Aplicar sobre una base limpia:

```bash
docker compose up -d postgres
npx prisma migrate deploy
```

### Restricciones que impone la base de datos

Más allá de lo que expresa el esquema Prisma, la migración añade:

- unicidad de documento por tenant: `(tenantId, documentType, documentNumberNormalized)`;
- claves foráneas **compuestas** `(id, tenantId)` que impiden asociar registros
  entre tenants distintos;
- coherencia territorial: departamento y municipio exigen código oficial y no
  pertenecen a un tenant; barrio y vereda exigen tenant y municipio padre;
- coherencia de localidad: o hay unidad canónica, o la dirección queda pendiente
  de normalización con su texto declarado conservado aparte;
- forma del hash de sesión (`^[0-9a-f]{64}$`), que impide guardar por error un
  token en claro;
- `expiresAt > createdAt` en la sesión de inscripción.

### Datos de referencia

`20260821120100_core_01_reference_data` es **idempotente** (`ON CONFLICT DO
NOTHING`) y carga:

1. el tenant institucional MVP `merdn-mvp`;
2. 33 departamentos y 1.122 municipios oficiales DANE DIVIPOLA.

Procedencia: el archivo se genera desde `apps/web/src/data/divipola.ts`, cuya
cabecera documenta la fuente, los recursos y los cortes de datos. Para
regenerarlo:

```bash
node prisma/tools/generate-territory-reference.mjs
```

**No se cargan barrios ni veredas.** DIVIPOLA no publica una codificación de
esas unidades y el repositorio no dispone de una fuente verificada. Mientras el
tenant no administre su catálogo local, la inscripción usa la opción canónica
`OTHER_PENDING_NORMALIZATION` y conserva el texto declarado por separado, sin
convertirlo en territorio oficial.

Ninguna migración contiene datos personales.

### Endurecimiento (migración 3)

`20260822120000_core_01_hardening` añade lo que solo la base de datos puede
garantizar:

- **Área urbana o rural obligatoria** en `patient_address`. La declara la
  persona en la Inscripción; no se infiere.
- **Integridad territorial** mediante triggers: un municipio cuelga de un
  departamento, un barrio o vereda cuelga de un municipio y exige tenant, y la
  dirección debe usar unidades del tipo correcto y coherentes entre sí. Una
  clave foránea compuesta impide que una dirección use una unidad local de otro
  tenant.
- **Auditoría append-only**: `audit_event` rechaza `UPDATE`, `DELETE` y
  `TRUNCATE` para cualquier rol, incluido el propietario de la tabla.
- **Row Level Security** sobre las nueve tablas de negocio, con el rol
  `merdn_runtime`.

#### Rol runtime

`merdn_runtime` se crea **sin LOGIN** de forma deliberada: así no se inventa ni
se versiona ninguna credencial. La aplicación lo adopta dentro de cada
transacción de negocio con `SET LOCAL ROLE`, de modo que PostgreSQL aplica RLS
aunque la conexión se haya abierto con un rol administrativo.

El rol no es superusuario, no tiene `BYPASSRLS`, **no tiene `DELETE` en ninguna
tabla** y sobre `audit_event` solo puede `SELECT` e `INSERT`. El tenant activo se
fija por transacción con `set_config('merdn.tenant_id', …, true)`, de modo que
una conexión reutilizada del pool nunca hereda el contexto anterior.

#### Separación de credenciales

| Variable | Rol | Uso |
| --- | --- | --- |
| `DATABASE_URL` | propietario del esquema | migraciones y administración |
| `RUNTIME_DATABASE_URL` | mínimo privilegio | API en ejecución |

Con `MERDN_RUNTIME_ROLE=enforce` la API **no arranca** sin
`RUNTIME_DATABASE_URL`, y tampoco si es idéntica a `DATABASE_URL`: no existe
repliegue a la credencial administrativa.

El rol se crea sin `LOGIN` para no versionar contraseñas. Antes del primer
arranque en modo `enforce` hay que habilitarlo fuera del repositorio:

```sql
ALTER ROLE merdn_runtime LOGIN PASSWORD '<contraseña gestionada aparte>';
```

#### Fail-closed

Dentro de cada transacción de negocio la API adopta el rol y **comprueba** que
el rol efectivo y el tenant activo son los esperados. Si el rol no existe, no
puede adoptarse o el contexto no puede confirmarse, la transacción se aborta
antes de ejecutar ninguna consulta de negocio y la API responde con un error
seguro que no describe la topología. Nunca continúa con privilegios superiores.

La variable `MERDN_RUNTIME_ROLE=disabled` desactiva la adopción del rol. Existe
solo para motores de desarrollo que no sostienen RLS, se anuncia con una
advertencia en el arranque y no debe usarse con datos reales.

### Rollback

`prisma/migrations/ROLLBACK-core_01.sql` **no se ejecuta automáticamente**.
Revertir CORE-01 elimina todas las personas, pacientes, pertenencias,
direcciones, consentimientos, sesiones y eventos de auditoría almacenados: es
una operación destructiva que requiere autorización expresa del Product Owner y
respaldo previo verificado en cualquier entorno con datos.

## 4. Comandos

Desde la raíz del repositorio, con `.env` configurado:

```bash
npm run prisma:validate   # valida el esquema
npm run prisma:format     # formatea el esquema
npm run db:check          # verifica la conexión a PostgreSQL
npx prisma generate       # genera el cliente
npx prisma migrate deploy # aplica las migraciones pendientes
```

### Verificación de conexión (`npm run db:check`)

Ejecuta una sentencia **no mutante** (`SELECT 1;`) mediante
`prisma db execute --stdin`. Garantías:

- no crea tablas, modelos, migraciones ni datos;
- no imprime `DATABASE_URL` ni ninguna credencial;
- falla con un mensaje técnico claro si falta la configuración o si PostgreSQL
  no está disponible.

Salida esperada sin PostgreSQL (fallo claro, sin credenciales):

```text
Error: P1001
Can't reach database server at `127.0.0.1:5432`
[db:check] ERROR: la verificación de conexión falló (código de salida 1). ...
```

### Comprobación del esquema aplicado

```bash
docker compose exec postgres \
  psql -U merdn_dev -d merdn_dev -c "\dt public.*"
```

## 5. Pruebas contra PostgreSQL

Las pruebas de integración de `apps/api/test/` exigen PostgreSQL real y **no se
sustituyen por dobles de prueba**. Cuando la base no está disponible o el motor
no atiende conexiones concurrentes como un servidor, las pruebas afectadas se
marcan como **no ejecutadas** con un motivo visible en la salida.

```bash
docker compose up -d postgres
npx prisma migrate deploy
npm run test --workspace @merdn/api
```

## 6. Nota de seguridad

Los scripts de instalación de `prisma` y `@prisma/engines` están aprobados de
forma explícita en `allowScripts` de `package.json` (necesarios para descargar
el motor de esquema). El script de `@scarf/scarf` — un paquete de telemetría —
**no** está aprobado deliberadamente.
