# Runbook de remediación FORCE RLS

Este runbook describe cómo aplicar y verificar `FORCE ROW LEVEL SECURITY` en las
26 tablas protegidas de MERDN, y qué hacer cuando la aplicación falla o se
detecta un bypass de propietario.

**Este documento no autoriza la ejecución de nada.** Es guía operativa para un
operador autorizado. No se ejecutó ningún comando de Docker, PostgreSQL,
Prisma ni migración al escribirlo: todas las consultas de catálogo que aparecen
son de solo lectura y están pensadas para que el operador las ejecute en el
entorno correcto.

**Este documento no es una certificación regulatoria.** No demuestra por sí solo
cumplimiento de la Ley 1581 de 2012, de la Sentencia T-319 de 2025, de FURAG,
MIPG, ADRES ni de ninguna norma. La evidencia técnica que aquí se recoge es
insuficiente por sí sola para una afirmación de cumplimiento; esa evaluación
corresponde a revisión humana con autoridad.

## 1. Propósito, alcance y autoridades

### 1.1 Propósito

Garantizar que el acceso a datos protegidos no dependa de que la aplicación se
comporte bien. Con `ENABLE ROW LEVEL SECURITY` sin `FORCE`, el propietario de la
tabla sigue leyendo y escribiendo todo sin filtros. `FORCE` elimina ese bypass
implícito del propietario no privilegiado.

El riesgo que este runbook cierra es concreto: cualquier proceso futuro que se
conecte con el rol de propietario, un script de soporte, un job o una
intervención manual con privilegios más amplios de los que aparenta.

### 1.2 Alcance

- Las 26 tablas protegidas de `public` y sus 27 policies.
- La migración forward `20260830160000_force_rls_core_institutional_hospital`
  (MP04), que aplica `FORCE` a 15 tablas del núcleo institucional y hospitalario.
- Verificación de que los owners de esas tablas no tienen `rolsuper` ni
  `BYPASSRLS`, y que el rol runtime `merdn_runtime` tampoco.

### 1.3 Fuera de alcance

- Crear tablas, policies, roles o datos.
- Cambiar el schema Prisma, el modelo de datos o el código de la API.
- Tocar `public` fuera de las 26 tablas, o migraciones ya aplicadas.
- Cualquier migración reversa o `down` improvisado (ver sección 5).

### 1.4 Autoridades

| Rol | Puede |
|---|---|
| Product Owner | Aprobar la ventana, la ruta de emergencia `NO FORCE` y cualquier excepción |
| Operador de despliegue | Ejecutar el preflight, aplicar la migración versionada y el postflight |
| Codex (arquitectura y revisión) | Especificar, auditar y verificar evidencia; no aplica migraciones |
| Claude Code (implementación) | Escribir migraciones y pruebas bajo especificación aprobada; no las ejecuta en un entorno compartido |

Ninguna autoridad técnica sustituye al Product Owner para decidir una excepción.
Una ventana de mantenimiento o una reversión de `FORCE` no son decisiones del
operador.

### 1.5 Riesgos principales

| Riesgo | Consecuencia | Mitigación en este runbook |
|---|---|---|
| Lock por tráfico en vivo | Migración abortada a mitad, o cola bloqueada | `lock_timeout` de 5s y ventana controlada (sección 2.4) |
| Migración parcial | Estado incoherente entre tablas | Transacción única en la migración versionada (sección 3) |
| Ejecutar en el entorno equivocado | `FORCE` en una base equivocada, o alterando staging | Identidad de base verificada en preflight (sección 2.1) |
| Owner con `BYPASSRLS` o superusuario | `FORCE` no restringe: falsa sensación de seguridad | Postflight de atributos de owner (sección 4.3) |
| Reintento automático tras un fallo | Doble aplicación o estado parcial | Nunca reintentar a mano; sección 5 |
| Evidencia con datos sensibles | Fuga de PII o secretos en la bitácora | Evidencia agregada y sanitizada (sección 4.5) |

### 1.6 Precondiciones

Todas deben cumplirse antes de abrir la ventana:

1. La migración forward de MP04 está disponible en el repositorio y es la única
   vía de aplicación prevista.
2. Hay una ventana de mantenimiento controlada, acordada y anunciada, con
   responsable de la decisión de abortar.
3. El rol que aplica la migración (migrator/owner) es distinto del rol runtime
   `merdn_runtime`.
4. `merdn_runtime` existe y no tiene atributos inseguros.
5. La identidad de la base de datos objetivo está confirmada por dos medios
   independientes, no solo por la variable de entorno.
6. Existe un respaldo verificable previo, si la ventana lo exige.
7. La evidencia que se recopile estará sanitizada y sin datos personales.

## 2. Preflight

El preflight decide si se continúa. Su resultado es STOP o GO, y STOP siempre
gana ante la duda.

### 2.1 Identidad de base de datos y entorno

Nunca confíes solo en `DATABASE_URL`. Un cambio de host, base o contenedor es
el modo de fallo más caro de este procedimiento.

Verifica y registra, como mínimo:

- Servidor y puerto effective.
- Nombre de la base.
- Versión de PostgreSQL.
- Si el entorno es local, Compose de pruebas, staging o producción.
- Identificador del despliegue o commit que se está operando.

La confirmación debe contrastar dos fuentes: por ejemplo la URL resuelta y una
consulta al propio servidor. Si las dos no coinciden, es STOP.

```sql
SELECT current_database() AS base,
       current_user     AS usuario,
       inet_server_addr() AS servidor,
       inet_server_port() AS puerto,
       version()        AS version_postgres;
```

### 2.2 Migraciones previas aplicadas

La migración de MP04 es forward-only y espera encontrar un esquema ya
migrado. Si falta una migración anterior, la operación no es una remediación de
`FORCE` sino una migración de schema mal planificada: STOP.

```sql
SELECT migration_name, finished_at, rolled_back_at
  FROM _prisma_migrations
 ORDER BY finished_at DESC NULLS LAST, migration_name
 LIMIT 15;
```

Revisa que la entrada de MP04 no esté ya aplicada. Una migración ya aplicada
no se reaplica: aplica la sección 5.

### 2.3 Las 26 tablas y las 27 policies

```sql
SELECT count(*) AS tablas_con_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relrowsecurity;
```

```sql
SELECT schemaname, tablename, count(*) AS policies
  FROM pg_policies
 WHERE schemaname = 'public'
 GROUP BY schemaname, tablename
 ORDER BY tablename;
```

Compara el resultado con el conjunto congelado de 26 tablas y 27 policies de la
especificación 025. Un número menor indica que falta una migración previa; un
número mayor puede indicar objetos nuevos no revisados. Cualquier diferencia es
STOP hasta que se entienda el origen.

### 2.4 Locks y sesiones

`ALTER TABLE ... FORCE ROW LEVEL SECURITY` necesita acceso exclusivo breve sobre
cada tabla. Con tráfico en vivo, la migración espera el lock y el tráfico
espera a la migración.

```sql
SELECT l.locktype, c.relname, a.pid, a.state, a.wait_event_type
  FROM pg_locks l
  LEFT JOIN pg_class c ON c.oid = l.relation
  JOIN pg_stat_activity a ON a.pid = l.pid
 WHERE l.locktype IN ('relation', 'RowExclusiveLock', 'ShareLock')
   AND c.relname IN (/* las 26 tablas protegidas */)
   AND a.pid <> pg_backend_pid();
```

```sql
SELECT gid, prepared, owner FROM pg_prepared_xacts;
```

La migración de MP04 aborta por sí misma ante locks ajenos y ante
transacciones preparadas, con `SET LOCAL lock_timeout = '5s'` y
`SET LOCAL statement_timeout = '60s'`. Preflight y postflight de esa migración
son adicionales: no los sustituyes, los complementas con la verificación de
identidad.

Si hay contención, no esperes en el loop. STOP, acortas o cancelas la ventana.

### 2.5 Roles y owners

```sql
SELECT r.rolname,
       r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolreplication
  FROM pg_roles r
 WHERE r.rolname = 'merdn_runtime';
```

Todas las columnas de atributos deben ser `false`. Cualquier `true` es STOP
inmediato: el runtime no debe poder saltarse RLS.

```sql
SELECT c.relname, o.rolname AS propietario, o.rolsuper, o.rolbypassrls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_roles o ON o.oid = c.relowner
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relname IN (/* las 26 tablas protegidas */)
 ORDER BY c.relname;
```

Dos condiciones obligatorias por tabla:

1. El propietario **no** puede ser el rol runtime.
2. El propietario **no** puede tener `rolsuper` ni `rolbypassrls`.

La segunda es la que suele pasarse por alto: `FORCE` no restringe a
superusuarios ni a roles `BYPASSRLS`. Si el dueño de una tabla tiene esos
atributos, `FORCE` se aplica, la consulta de verificación lo muestra activo, y
aun así la tabla sigue siendo accesible sin filtros. La garantía sería falsa.

Si el owner de una tabla protegida resulta ser superusuario o `BYPASSRLS`, no
lo resuelvas cambiando `FORCE`: eso ya está activo. Es un hallazgo de diseño
que debe volver a Codex y al Product Owner, porque la corrección es cambiar la
propiedad del rol, no la política.

### 2.6 Decisión

| Situación | Decisión |
|---|---|
| Identidad de base confirmada por dos fuentes | Continuar |
| Migraciones previas aplicadas y coherentes | Continuar |
| 26 tablas y 27 policies coinciden | Continuar |
| Sin locks ajenos ni transacciones preparadas | Continuar |
| Runtime sin privilegios de bypass; owners sin superuser/`BYPASSRLS` | Continuar |
| Cualquier discrepancia, timeout o contención | **STOP** |
| Duda no resuelta en la ventana | **STOP** |

## 3. Aplicación segura

### 3.1 Reglas

1. Usa la migración versionada del repositorio:
   `prisma/migrations/20260830160000_force_rls_core_institutional_hospital/migration.sql`.
   Aplícala **una sola vez**, con el mecanismo de migración del proyecto y el
   DATABASE_URL del migrator/owner.
2. La migración es una transacción única: su `BEGIN` y su `COMMIT` son parte del
   archivo, con `lock_timeout` de 5s y `statement_timeout` de 60s. Un fallo
   antes del commit no deja estado parcial.
3. Sus preflight y postflight internos son obligatorios y abortan con
   excepción si el esquema no es el esperado. Déjalos actuar: un postflight que
   se ignora es una ventana de remediación que no ocurrió.

### 3.2 Prohibiciones

Nunca, bajo ninguna circunstancia:

- Escribir SQL manual equivalente a la migración.
- Reintentar automáticamente ante un fallo, ni "reintentar a ver si era un lock".
- Aplicar la migración con el rol runtime: el preflight de MP04 lo rechaza, y
  esa restricción es intencional.
- Usar el superusuario para conectar la aplicación. Superusuario es una
  herramienta de migración y de emergencia, no una identidad de runtime.
- Poner `MERDN_RUNTIME_ROLE=disabled` o cualquier equivalente que desactive el
  enforcement para "desbloquear" la ventana. Desactivar RLS por comodidad
  convierte un incidente de despliegue en una exposición de datos.
- Editar migraciones ya aplicadas, ni el historial de migraciones, para hacer
  que una ejecución fallida parezca correcta.
- Marcar la migración como aplicada sin haberlo ejecutado.

### 3.3 Durante la ventana

- Un solo operador responsable, con decisión explícita de abortar.
- Si la migración no termina dentro del `statement_timeout`, se detiene sola.
  No la reinicies dentro de la misma ventana sin volver al preflight.
- Registra hora de inicio, hora de fin, resultado y cualquier excepción
  recibida, con valores literales.

## 4. Postflight

El postflight confirma el estado final. Su resultado debe quedar en la evidencia
del despliegue, sanitizado.

### 4.1 Las 26 tablas con ENABLE y FORCE

```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relname IN (/* las 26 tablas protegidas */)
 ORDER BY c.relname;
```

Las 26 filas deben tener ambas columnas en `true`. Cero filas con
`relforcerowsecurity = false` es STOP: la remediación no se aplicó.

### 4.2 Las 27 policies

```sql
SELECT count(*) AS policies_public
  FROM pg_policies
 WHERE schemaname = 'public';
```

Y por tabla, ninguna puede quedarse sin policy si tiene filas: una tabla
protegida sin policy y con datos es indistinguible de una tabla vacía.

### 4.3 Owners sin superuser ni BYPASSRLS

```sql
SELECT o.rolname AS propietario, count(*) AS tablas,
       bool_or(o.rolsuper)     AS algun_superusuario,
       bool_or(o.rolbypassrls) AS algun_bypassrls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_roles o ON o.oid = c.relowner
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relname IN (/* las 26 tablas protegidas */)
 GROUP BY o.rolname
 ORDER BY o.rolname;
```

`algun_superusuario` y `algun_bypassrls` deben ser `false` en cada fila. Aquí se
detecta el bypass que `FORCE` por sí solo no cubre.

### 4.4 Runtime sin privilegios inseguros

```sql
SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
  FROM pg_roles WHERE rolname = 'merdn_runtime';
```

```sql
SELECT has_database_privilege('merdn_runtime', current_database(), 'CREATE') AS puede_crear_en_la_base;
```

Sin atributos inseguros y sin permiso de `CREATE` en el esquema `public`.

### 4.5 Evidencia sin datos personales ni secretos

La evidencia admitted es agregada y no identificable: conteos, nombres de
tabla, nombres de rol, atributos booleanos, marcas de tiempo y excepciones
literales. No se admite: filas de datos, `SELECT *` de tablas con contenido,
identificadores de personas, cadenas de conexión, contraseñas, tokens ni
contenido de variables de entorno. Si una excepción incluye un valor sensible,
se redacta antes de archivarse y se deja constancia de la redacción.

### 4.6 Pruebas conductuales posteriores

En un entorno aislado, después del postflight, las pruebas de catálogo de la
especificación 025 (`apps/api/test/force-rls-catalog.db.test.ts`) y las pruebas
de comportamiento de las tablas core son la comprobación final. Estas pruebas
son de solo lectura para el operador de este runbook: se ejecutan según el procedimiento
de pruebas de la especificación, no durante la ventana de remediación.

## 5. Fallo y remediación

### 5.1 Fallo antes del commit

La transacción revierte sola. Confirma que no quedó nada a medias y abre la
sección 2 de nuevo antes de reintentar. Un reintento solo es legítimo tras un
preflight completo y favorable.

### 5.2 Fallo después del commit

No existe reversión. La única vía es una migración forward nueva y aprobada,
que corrija el estado. Editar la migración aplicada o el historial está
prohibido y rompe la trazabilidad de la evidencia.

### 5.3 Ruta de emergencia `NO FORCE`

`ALTER TABLE ... NO FORCE ROW LEVEL SECURITY` es una excepción, no un
procedimiento. Solo puede ocurrir si se cumplen, a la vez, todas estas
condiciones:

1. **Aprobación explícita y previa del Product Owner**, registrada, con motivo
   concreto. "Era más rápido" no es motivo.
2. **Tabla exacta** identificada. La emergencia es por tabla, nunca un lote.
3. **Ventana** definida y con hora de expiración acordada.
4. **Evidencia de aislamiento alternativo**: qué mecanismo, ya activo,
   impide el acceso no filtrado mientras la tabla está sin `FORCE`.
5. **Registro de regresión** con responsable y fecha compromiso para reponer
   `FORCE`.

Sequence obligatoria ante una emergencia:

1. Detener y escalar: el operador avisa, no improvisa.
2. Obtener la aprobación del Product Owner con los cinco puntos de arriba.
3. Aplicar `NO FORCE` solo sobre la tabla aprobada.
4. Registrar la excepción en la bitácora de decisiones.
5. Reponer `FORCE` en cuanto la causa desaparezca, con migración forward
   aprobada.

Nunca se hace un `down` improvisado, ni se rehace la migración a mano, ni se
deja una tabla en `NO FORCE` sin fecha de regreso.

## 6. Checklist de cierre y auditoría

### 6.1 Cierre de la ejecución

- [ ] Identidad de base confirmada por dos fuentes independientes.
- [ ] Migraciones previas verificadas; MP04 no estaba ya aplicada.
- [ ] 26 tablas y 27 policies verificadas antes de aplicar.
- [ ] Sin locks ajenos ni transacciones preparadas.
- [ ] `merdn_runtime` sin `rolsuper`, `rolbypassrls`, `rolcreatedb`,
      `rolcreaterole` ni `rolreplication`.
- [ ] Ningún owner de las 26 tablas es el runtime, superusuario o `BYPASSRLS`.
- [ ] Migración versionada aplicada una sola vez, con el migrator/owner.
- [ ] Postflight: 26 tablas con `ENABLE` y `FORCE`.
- [ ] Postflight: 27 policies presentes.
- [ ] Postflight: owners y runtime sin privilegios de bypass.
- [ ] Evidencia sanitizada, sin PII ni secretos.
- [ ] Pruebas conductuales posteriores ejecutadas en entorno aislado.

### 6.2 Auditoría e incidentes

- [ ] **Conflicto de lock**: registrado la tabla, el pid, la espera y la causa.
      No se reintentó en bucle; se repitió el preflight antes del reintento.
- [ ] **Bypass de owner** detectado: no se "solucionó" tocando `FORCE` ni la
      policy. Escalado a Codex y Product Owner como cambio de propiedad del rol.
- [ ] **Migración parcial**: imposible por transacción única; si el postflight no
      cuadra con el commit, tratado como incidente y escalado, no como ajuste
      manual.
- [ ] **Ejecución contra entorno equivocado**: STOP antes de aplicar, y
      verificación de que no se aplicó nada en el entorno incorrecto.
- [ ] **Cleanup de test**: ningún objeto de prueba, base temporal, rol extra,
      archivo secreto o tabla de verificación quedó en el entorno. La evidencia
      declara que no quedó nada.
- [ ] La bitácora de decisiones registra cualquier excepción `NO FORCE` con los
      cinco campos de la sección 5.3.
