# Acceso Eloisa y panel municipal con registros guardados

Actualizado: 2026-10-14. Rama local: `fix/acceso-eloisa-local`.

## Composición municipal vigente — 051

El PO corrigió el objetivo a /municipality con referencia
`prototype-claude/Eligeme-Alcaldia.dc.html`. Se ajustó la cabecera y compactó la
repetición de procedencia en Inicio, conservando los cuatro conteos, corte y
supresión de API. Menú azul de trece destinos, cadena, tarjetas y componentes
visuales existentes se conservan.

Los diez apartados sin consulta ahora tienen títulos y secciones diferenciados
según la referencia: programas; presupuesto por población; facturas/soportes y
trazabilidad; resultado FURAG/mapa MIPG; información ADRES/contraste agregado;
acciones/matriz de cuidado; brechas; cuidadores/ruta de formación; comparación
de indicadores/satisfacción; catálogo de informes. Se muestran estructuras de
presentación con estados pendientes, no registros consultados ni cálculos.
Tablas vacías indican expresamente que no hubo consulta; tarjetas y rutas no
afirman ejecución, matrícula, certificación o generación de archivos.

**Límite funcional:** esto no implementa las consultas ni operaciones de esos
diez módulos. No hay cifras de ejemplo, filas, programas, documentos, movimientos
o actividad simulados; no se habilitan formularios, descargas o filtros sin
servicio real. Inicio/Población/Territorio siguen consultando la misma API.
Hospital, acceso/login, permisos, cuentas, datos, API y prototipo intactos.

Aplicado solo web: `merdn-web:eloisa-municipality051`, ID
`sha256:71b56a24069d1a78c91d9ca866b590a3c3773821af2462c1be57f100089c01ad`.
API050 y contenedores PostgreSQL/IdP conservan IDs; env/usuario/puertos/red,
healthcheck y opciones de seguridad web verificadas iguales. Backup privado de
imagen/configuración anterior en instalación051; rollback restaurando solo web.
Fuentes previas `.tmp/before051/`. Sin migración ni Git.

93 casos focales municipales en cinco archivos, sin añadir casos; build web con
tipos, lint/scanner/diff correctos. Revisión estática independiente sin
bloqueantes. E2E real con cuenta municipal existente: trece vistas a1340/768/320,
foco/menú/Escape/skip, todas las vistas con axe0 en escritorio y móvil Inicio
axe0, conteos y supresión API, error503/reintento/401 sin fallback, nombre
institucional largo, Hospital denegado y logout204/post401. Evidencias
`.tmp/web051-focused.txt`, `build-web051.txt`, `lint051.txt`, `secrets051.txt`,
`deploy051.txt`, `e2e051.txt`, `gate051.txt`, `strict051.txt`. Comprobación adicional
de desplazamiento real con teclado de tabla presupuestal a320px: `.tmp/table051.txt`,
PASS sin desborde de página. Capturas actuales
por vista en `.tmp/ui051/`, comparadas con referencia `.tmp/ui048/prototype-reference.png`.

## Cuenta local de Hospital solicitada por el PO

Por solicitud expresa «necesito un usuario también para hospital», se creó el
primer administrador Hospital mediante el registro real existente. Identidad
de prueba declarada (Administrador Prueba Hospital), no un funcionario real.
Registro CONFIRMED, cuenta ACTIVE y evento de confirmación SUCCESS verificados
en base; el cupo inicial Hospital quedó cerrado. La cuenta municipal se conserva
separada. No se usó claim para otorgarle Hospital ni se alteraron sus permisos.

Credenciales y referencias para limpieza posterior solo en el archivo privado
ignorado `.secrets/hospital-admin-user-test/manifest.json`; no se copian aquí.
La creación y verificación se hicieron con las imágenes050 vigentes, sin cambio
de código, esquema, despliegue o Git. Cuenta conservada para las pruebas del PO;
no se ejecutó limpieza.

Comprobado login real PKCE S256/callback, panel Hospital en navegador y cuatro
capacidades del administrador ya definidas por040. Esa cuenta recibe401 en
administración municipal y403 en patient-self. Sesiones de verificación cerradas
con204 y posterior401. Evidencias `.tmp/create-hospital-admin-result.txt`,
`.tmp/verify-hospital-admin-result.txt` y `.tmp/hospital-user-test/panel.png`.

## Paciente local solicitado por el PO

Por solicitud expresa «hazme 1 usuario para paciente», se registró una única
cuenta de prueba (Paciente Prueba) mediante access-requests, con identidad
ficticia declarada. La solicitud se aprobó por el endpoint de revisión usando
la cuenta Hospital creada a petición del PO. La saga real confirmó APPROVED y
habilitó la participación mínima PATIENT; no se escribieron cuentas, permisos
ni estados directamente en la base.

El inicio real desde el hub, con las credenciales nuevas, retornó a /acceso y
abrió /paciente. Experiencia PATIENT exclusiva, resumen propio200, citas/visitas
vacías200; sin historias, citas, visitas, diagnósticos o vínculos inventados.
Administraciones Hospital/Alcaldía y bandeja de revisión denegadas. Sesiones de
aprobación y verificación cerradas con204, consulta posterior401.

Credenciales y referencias para limpieza posterior exclusivamente en
`.secrets/patient-user-test/manifest.json`, privado e ignorado. Evidencia
`.tmp/create-patient-user-result.txt`, captura `.tmp/patient-user-test/panel.png`.
No se cambió código, esquema, configuración Docker o Git ni se eliminó la cuenta.
El helper API no retenía la cookie Secure de intento sobre HTTP loopback: se
usó el token exacto de propiedad emitido por el endpoint en la siguiente petición
de registro, sin modificar la cookie del producto ni inventar una identidad.
Los intentos previos se detuvieron antes del único registro de cuenta.

## Acceso personal vigente — 050

El PO comunicó el mismo cruce en pacientes. El botón «Iniciar sesión» de
Atención Domiciliaria ahora abre directamente OIDC con retorno `/acceso`, sin
consultar antes una sesión institucional. API pide credenciales también para
ese destino, sin convertir el ingreso ordinario en step-up. El selector de
`/acceso` conserva solo PATIENT/CAREGIVER/FIELD_PROFESSIONAL aprobados por el
servidor: uno abre su portada, varios permiten elegir, ninguno muestra una
denegación personal y la acción «Ingresar con otra cuenta». Una cuenta solo
municipal no vuelve a Alcaldía desde esta entrada ni recibe acceso de paciente.

Aplicado desde este checkout: `merdn-api:eloisa-login050`, ID
`sha256:bda4d2219e9e9d2ed5207827b5d98cff210b580b9e186ff84275fe97993cdb18`;
`merdn-web:eloisa-login050`, ID
`sha256:b70d690022fd902937515176b5709cf3417177b51fdcd0c490a337d6284209eb`.
Configuración e imágenes previas respaldadas privadamente; se comprobaron
env, puertos, red, usuario, salud, opciones de seguridad y contenedores
PostgreSQL/IdP originales. Sin migración ni cambios de cuentas/permisos/datos.
Rollback restaurando ambas imágenes y configuración 049. Se conservan el
panel municipal 048 y las entradas institucionales corregidas en 049.

Validación focal: 105 casos web en tres archivos; PostgreSQL aislado
`baseline-20261014t231135`, 22 casos human-auth y 26 personal, cero fallos u
omisiones y limpieza correcta. Se reutilizaron las aserciones de callback
existentes para comprobar `/acceso` interactivo y campos step-up vacíos. Una
prueba nueva cubre el filtro con listas institucionales, mixtas, personales y
vacías. Builds API/web, tipos API, lint y scanner correctos.

La revisión independiente detectó un retorno de compatibilidad: la verificación
de identidad de recuperación administrada Hospital volvía a `/acceso`. Ahora
retorna explícitamente `/hospital`, ya permitido, con las mismas guardas y
vínculos step-up. Se amplió el caso existente para recorrer POST/callback y
comprobar destino, vínculo sesión/cuenta/identidad, revocación anterior y nueva
sesión fresca. Se eliminó de ese caso la inyección directa de freshness en DB.
Revisión estática independiente final sin bloqueantes después del ajuste;
suite aislada final anterior incluye el caso ampliado y pasó completa.

Durante el segundo reemplazo, la comprobación estricta detectó únicamente
distinto orden en los mismos dos ExtraHosts locales y retuvo el mutex de
mantenimiento. No se aceptó ese resultado. Se verificaron imágenes finales,
configuración completa (hosts como conjunto), salud200 y contenedores
PostgreSQL/IdP sin cambios; después se liberó únicamente el mutex propio de
ese proceso ya terminado. Evidencia final `.tmp/deploy050-resolved.txt` y
resolución privada junto al respaldo. El helper temporal compara ahora hosts
sin depender del orden. La evidencia `.tmp/deploy050.txt` conserva el intento
rechazado; no es la confirmación final de operación.

E2E real mismo navegador/cuenta municipal: Alcaldía→ingreso personal solicita
credenciales, callback `/acceso`, denegación sin vuelta a institución, API
patient-self403, recarga sin bucle de login y cambio de cuenta disponible en
IdP. Registro guiado intacto; Hospital sigue denegado a esa cuenta y Alcaldía
abre su panel; logout204 seguido de401. Axe sin infracciones. Sin cuentas
nuevas. La navegación de perfiles personales aprobados únicos/múltiples se
comprobó con respuestas de API controladas solo en la prueba; no se probó con
credenciales reales de un paciente aprobado ni se inventó ese usuario en la
base local. Evidencias `.tmp/web050-focused.txt`, `.tmp/db-human050.txt`,
`.tmp/db-personal050.txt`, `.tmp/cleanup050.txt`, `.tmp/deploy050-resolved.txt`,
`.tmp/e2e050.txt`; capturas `.tmp/login050/`. Sin commit/push.

## Acceso institucional — 049 (conservado en 050)

Corregido el regreso a Alcaldía al elegir Hospital: los enlaces del hub y de
acceso/registro conservan un destino literal `/hospital` o `/municipality` en
el intento OIDC. Ambos ingresos piden credenciales (`prompt=login`, `max_age=0`)
incluso con SSO previo. No pasan por el selector común `/acceso`; el ingreso
personal conserva su recorrido. Elegir una institución no concede permisos ni
autenticación reforzada para operaciones privilegiadas. Sigue existiendo un
proveedor y una sesión humana por navegador, sin sesiones institucionales
simultáneas independientes.

Docker desde este checkout: API `merdn-api:eloisa-login049`, ID
`sha256:47a4367b9ff3103d209e5e08bd21c0aa6d5f6dd472cd7a323dfadd1e56f2adf4`;
web `merdn-web:eloisa-login049`, ID
`sha256:5effe4715e23427e124d46cfdb950a390a86d03e7ad8e9b50906640212b70285`.
La web conserva la presentación municipal 048. Se preservaron configuración,
puertos, red y los contenedores originales PostgreSQL/IdP.

La migración 24 amplía únicamente el CHECK de destinos del intento. Backup
privado restaurado en PostgreSQL desechable sin red y verificado por conteos y
checksums de todas las tablas de aplicación; datos idénticos durante migración.
Evidencia `.tmp/deploy049.txt`. Rollback: restaurar imágenes anteriores y
conservar la migración aditiva; API anterior rechaza los nuevos destinos
pendientes. No borrar ni reescribir intentos o cuentas.

Validación: 1850 casos web/73 archivos; PostgreSQL aislado final
`baseline-20261014t225325`, 22 casos human-auth y 26 personal sin fallos ni
omisiones, con limpieza verificada. Tipos, builds, lint, scanner y contratos
de inventario/theme correctos. Se corrigió una aserción previa de recuperación
que seleccionaba una solicitud sin ID concreto. Las ejecuciones intermedias
fallida y omitida se rechazaron antes de desplegar.

E2E real con la cuenta municipal existente y un mismo navegador: Alcaldía →
Hospital solicita credenciales; callback conserva Hospital; credenciales
municipales no abren su panel; regreso a Alcaldía y logout correctos. Sin
prefetch, PKCE S256 y axe sin infracciones. No se crearon cuentas ni se cambiaron
roles, permisos o cupos de registro. Evidencias `.tmp/e2e049.txt`,
`.tmp/db-human049.txt`, `.tmp/db-personal049.txt`, `.tmp/web049.txt` y capturas
en `.tmp/login049/`.

La reautenticación reveló un input readonly sin nombre accesible en el template
padre de Keycloak 26.7.1. Se versionó ese template con un único `aria-label`,
comentario de modificación, licencia y procedencia; se conservan todas las
ramas y acciones originales. El instalador comprobó cuentas y configuración
iguales antes/después, sin reiniciar IdP. Véase
`infra/local-oidc/THEME-PROVENANCE.md`. Revisión final de fuentes, seguridad y
evidencias realizada por Codex; no hubo revisión independiente final 049 por
el límite de uso del servicio adicional. Sin commit/push.

## Presentación municipal — 048

Por nueva indicación expresa del PO, /municipality sigue la composición de
`prototype-claude/Eligeme-Alcaldia.dc.html`: sidebar azul de276px, trece destinos
en orden, cabecera institucional y perfil, hero azul, cadena persona/evidencia,
pendientes, accesos rápidos y actividad. Prototipo intacto y sin runtimeDC en
producto. Se reutilizan tokens/Nunito/componentes visuales existentes.

Los cuatro conteos y el corte siguen siendo los publicados por la API actual,
con supresión y errores sin fallback. Cobertura oficial, atención, dinero,
evidencia, resultados, pendientes y actividad se muestran como no disponibles
cuando carecen de consulta implementada; no se copian las cifras/eventos del
prototipo. La consulta temporal es una etiqueta actual, no filtros ficticios.
Nombre institucional desde sesión, con «Alcaldía» neutral cuando el registro
local contiene la marca técnica interna. No se modificó ese dato en la base.
Los otros nombres institucionales se conservan y envuelven sin desbordar.

Menú móvil con una navegación, Escape/foco, selección del destino actual y
salto al contenido. Población/Territorio y diez módulos pendientes mantienen
su comportamiento. Hospital, login y hub no se alteraron en esta tarea.

Imagen web usada en 048 `merdn-web:eloisa-prototype048`, ID
`sha256:3aeb7aa6dc3b5e60de20a3199398cc9dca6b547084cd7ded6ce00f8a1060e653`.
Se preservaron env/puertos/red y los IDs API/PostgreSQL/IdP. Fuentes previas en
`.tmp/ui-before048/`, imagen/config anterior respaldadas privadamente.

1849casos/73archivos web correctos, sin añadir casos. Se corrigieron dos
expectativas obsoletas del cambio047 en page.test.tsx: el contrato de los
destinos directos sigue comprobado por el caso SSR de CentralAccess.test.ts.
Build/TypeScript/lint/scanner correctos. E2E048: cuenta existente, 13destinos y
8accesos, orden del prototipo, menú/Escape/foco/skip, nombres largos a320/768/1340,
conteosAPI/503/reintento/401 sin cifras en hero ni cadena, logout, Hospital
denegado y axe0. Evidencias `.tmp/web048.txt`, `build-web048-final.txt`,
`e2e048.txt`, `lint048.txt`, `secrets048.txt`, `gate048.txt`, `strict048.txt`;
capturas comparadas en `.tmp/ui048/` incluidas prototype-reference.png y
dashboard-desktop.png. Revisión estática focal inicial sin bloqueantes; cierre
visual y corrección de nombre técnico revisados por Codex. El revisor adicional
no pudo completar su última revisión por límite de uso del servicio. Sin Git.

## Antecedente — 047: ingreso institucional directo desde el hub

El PO rechazó la tarjeta secundaria «Acceso a la Alcaldía» que requería otro
clic antes del formulario de credenciales. Se cambiaron únicamente los enlaces
«Ingresar al Hospital» e «Ingresar a Alcaldía» del hub: ahora son enlaces HTML
al helper compartido `urlDeLoginHumano()`, sin prefetch de intentos de acceso.

Recorrido: hub → Ingresar → login Eloisa del proveedor → callback → selector
autorizado existente. El selector obtiene las experiencias del servidor; la
tarjeta pulsada no concede ni inventa permisos. Se conserva `/acceso` como
retorno aprobado. Una sesión SSO vigente puede completar el acceso sin volver
a pedir credenciales. No se cambiaron proveedor, URL canónica ni login046.

Los enlaces separados «Registrar primer administrador» siguen condicionados por
la API. Se comprobó con el estado real: Alcaldía cerrado y Hospital disponible.
No se creó otra cuenta. Los paneles interiores, gates, datos y logout no se
modificaron. La tarjeta de acceso directo/sesión cerrada sigue existiendo en
esas rutas protegidas; ya no forma parte del recorrido desde «Ingresar» del hub.

Imagen activa `merdn-web:eloisa-entry047`, desde Eloisa-develop, ID
`sha256:2207cf3b43b68d6126b713a894cb48d37384a9badc9f6c85eb225e54aa0d6fbe`.
Se conservan env, puertos y red web; API/PostgreSQL/IdP mantienen IDs. Rollback
web y configuración anterior guardados privadamente por el helper de instalación.

Verificación: 91 casos focales en tres archivos, sin añadir casos; el caso de
navegación existente ahora comprueba los enlaces renderizados y retorno cerrado.
Build/TypeScript/lint/scanner/diff correctos. E2E de ambos botones: cero inicios
OIDC al renderizar o pasar el cursor, un solo inicio tras clic, ninguna visita
previa a páginas institucionales, formulario real y vuelta al portal correctos.
E2E con cuenta municipal existente confirma callback/panel, trece destinos,
conteos API/supresión, error503 sin cifras de respaldo y reintento, Hospital
denegado y logout204 seguido de401. Tras recargar no se inicia OIDC solo.
Login1440/768/320, visibilidad de contraseña, errores y axe0 verificados.
Revisión focal independiente de fuentes/build/E2E cerrada sin bloqueantes.

La comprobación antigua de logout podía consultar el contexto antes de concluir
el POST: se corrigió la espera de la prueba, sin cambiar producto. Durante una
repetición el formulario no apareció dentro del tiempo de espera; se inspeccionó
la ventana de intentos local y no se alteró ningún límite ni se reinició API.
Una vez confirmado inicio302, el recorrido completo pasó. Evidencia final:
`.tmp/web047.txt`, `build-web047.txt`, `lint047.txt`, `secrets047.txt`,
`entry047.txt`, `e2e047.txt`, `gate047.txt` y `strict047.txt`.
Capturas `.tmp/login047/hub.png`, `municipality-login.png`, `hospital-login.png` y
las capturas responsive/error/panel del mismo directorio. Sin commit/push.

## Antecedente — 046: login profesional, panel anterior restaurado

El PO corrigió el alcance: mejorar la página de login y revertir el rediseño del
panel. Se restauraron byte a byte Panel/CSS/prueba de la copia anterior a 045 y
se retiró su nueva navegación. Se conserva 044: registros guardados, supresión,
Población/Territorio y diez apartados pendientes, sin cifras de ejemplo.

Web vuelve a la imagen 044 por ID inmutable
`sha256:6ad9a9b27b4dfe430f25f279d5a66d5ae6b3ee8b31d99154dd0f2fa269d28784`.
Entorno, puertos, red y los IDs de API/PostgreSQL/IdP se conservaron. No se
modificaron datos, cuentas, contraseñas ni permisos.

El login real ahora tiene composición sobria con marca Eloisa, panel de
bienvenida, formulario legible y versión móvil compacta. Conserva plantillas
keycloak.v2, estilos base, validación, mostrar/ocultar contraseña y errores en
español. Anillo de foco oscuro y CSS versionado `?v=046` para no reutilizar la
presentación anterior en caché. No se cambia el origen OIDC ni se añade proxy.
La ayuda no promete recuperación automática: sigue administrada como aprobó PO.

Aplicación mediante script 043 existente, con backup privado y huellas iguales
de cuentas, clientes, perfil y configuración de seguridad. No se reinició IdP.
Las fuentes previas se guardaron en `.tmp/ui-before046/`; cada instalación y el
reemplazo web tienen respaldo privado en `.secrets/backups/`.

Verificación: 31 pruebas municipales semánticas/privacidad y tres de rollback
correctas; tipos web, lint, scanner y diff-check correctos. Se reutiliza la imagen
044 ya construida/verificada, sin reconstruir ni repetir la baseline de dominios
intactos. E2E real con cuenta existente: login/error/callback/logout, visibilidad
de contraseña, 13 destinos, conteos exactos API, error503 sin fallback y reintento,
Hospital denegado, recursos sin error. Login a1440/768/320px sin desborde; axe0
en login, tablet, error y panel. Revisión independiente de fuentes/capturas/foco
cerrada sin bloqueantes. La prueba espera el título Next tras navegar antes de
auditar accesibilidad, evitando una carrera de hidratación.

Evidencias: `.tmp/e2e046.txt`, `lint046.txt`, `types046.txt`, `secrets046.txt`,
`gate046.txt`, `strict046.txt`. Capturas reales de Docker en
`.tmp/login046/desktop.png`, `tablet.png`, `mobile.png`, `error.png` y
`municipality.png`. Cambios locales; no se hizo commit/push ni se tocaron ramas
protegidas. La conexión del navegador del usuario dejó de estar disponible al
final; no se afirma haber dejado su pestaña abierta ni actualizado su sesión.

## Rediseño del panel — 045 (revertido por petición del PO en 046)

Solicitud del PO: reconstruir la interfaz con una presentación profesional.
Imagen utilizada en esa entrega: `merdn-web:eloisa-ui045`, desde Eloisa-develop.
Sustituía visualmente la composición 044 descrita abajo; conservaba sus datos,
autorización y diez apartados pendientes. No se añaden cifras de ejemplo ni se
afirma que los datos de prueba actuales sean una fuente institucional oficial.

- Navegación única de trece destinos agrupada en vista general, gestión y
  gestión institucional, marca existente y selección visible.
- Cabecera con ubicación actual y cierre real de sesión; texto neutral de
  administrador, sin afirmar vigencia cuando una consulta devuelve 401/403.
- Indicadores con cuatro `display` exactos de la API, corte real en formato
  legible, accesos a Población/Territorio y tarjetas de privacidad/procedencia.
- Menú móvil desplegable en flujo, cerrado inicialmente. Escape abierto devuelve
  foco al botón; cerrado no roba foco. Seleccionar incluso el destino ya activo
  cierra el menú y enfoca el título. Incluye salto al contenido.
- Estados de carga, error, falta de sesión, vacío y pendientes rediseñados, sin
  filtros, gráficas, tendencias, actividad o acciones de escritura simuladas.

Se reemplazó únicamente web conservando env, puertos y red, con imagen anterior
respaldada por ID inmutable en configuración privada. API, PostgreSQL e IdP
mantuvieron sus IDs y no se modificaron usuarios, claves, tablas o permisos.

Verificación final: 1849 casos web/73 archivos correctos, sin nuevos casos
literales de CSS/snapshots. Tipos/build/lint/scanner/diff-check correctos.
E2E con la cuenta existente confirma login/logout, Hospital denegado, trece
destinos, conteos UI/API, 503 sin fallback y reintento, 401 sin cifras ni falsa
afirmación de sesión activa. Teclado y menú comprobados, axe0 en panel escritorio,
menú abierto, tablet y login, sin desbordamiento en 1440/768/320px. Revisión
independiente final de fuente/evidencias/capturas cerrada sin bloqueantes.

Evidencias locales: `.tmp/e2e045.txt`, `.tmp/web045-final.txt`,
`.tmp/build-web045-current.txt`, `.tmp/lint045-final.txt`, `.tmp/secrets045-final.txt`.
Capturas: `.tmp/ui045/dashboard-desktop.png`, `tablet.png`, `panel-mobile.png` y
`menu-mobile.png`. Fuentes previas preservadas en `.tmp/ui-before045/`.
No se repitió la baseline PostgreSQL sin cambios ni se crearon otras cuentas.
Esta corrección sigue local y no incluye publicación Git ni integración.

## Acceso aplicado — 043

El IdP activo no tenía el tema Eloisa del repositorio. Se instaló en el mismo
contenedor y se seleccionó con idioma español. El formulario ahora muestra
Eloisa, Usuario, Contraseña, Entrar, errores en español y vuelta al portal.
El campo pide el usuario entregado al completar el registro, no un correo que
el proveedor no tenga vinculado. No se sustituyen las plantillas de autenticación
o cambio obligatorio: se heredan de `keycloak.v2` y se conservan sus estilos base.

Se mantiene el origen OIDC canónico `merdn.localhost:8081`. Esta entrega retira la
presentación genérica; no oculta ni cambia el origen mediante un proxy nuevo.
La cuenta municipal ficticia solicitada por el PO sigue disponible. No se crea
otra cuenta, no se cambia su contraseña y no se reabre el registro inicial.

Aplicación reproducible desde la raíz, con Docker local en PATH:

```powershell
node scripts/identity/apply-local-login-theme.mjs
```

La operación valida daemon, contenedor, versión, loopback y origen; adquiere el
mutex de mantenimiento, respalda privadamente la presentación previa y el tema
anterior si existe. Copia/renombra el tema en el mismo contenedor, verifica lectura
como uid1000 y actualiza solo cinco campos de presentación/localización.
Compara hashes de todos los demás campos del realm, clientes, perfil y usuarios.
No reinicia, recrea, reimporta, cambia cuentas/grants/flujos ni imprime secretos.

Ante fallo restaura el tema anterior y los cinco campos con valores explícitos:
Keycloak ignora null en PUT, por lo que usa cadenas/arrays vacíos donde corresponde.
Un GET y la comparación de seguridad deben confirmar el rollback antes de
liberar el mutex. Si no se puede confirmar, guarda UNCERTAIN y conserva el lock.
No borrar ese lock ni repetir la operación sin inspeccionar el backup privado.
Para volver manualmente a la presentación anterior, el operador utiliza los
cinco valores de `before.json` y el tema respaldado en la carpeta privada de esa
ejecución, verifica por GET y nunca aplica un snapshot completo del realm.

## Panel municipal aplicado — 044

La ruta autenticada del administrador ya no monta el shell demostrativo:

| Apartado | Estado y procedencia |
|---|---|
| Inicio | Cuatro conteos y corte recibidos del resumen poblacional persistente |
| Población beneficiaria | API existente, registros del tenant y supresión |
| Territorio | API existente, distribución agregada y supresión |
| Programas, Presupuesto, Evidencias, FURAG/MIPG, ADRES, Derecho al cuidado, Brechas, Cuidadores/formación, Indicadores y Reportes | Diez apartados pendientes de habilitar; no se sirven tablas, cifras o acciones de ejemplo |

Se retiraron de esta ruta la ciudad/Secretaría del fixture, fechas, periodos sin
consulta, actividades y resultados inventados. La navegación estratégica se
conserva. Los fixtures históricos de diseño permanecen como referencia, sin
alimentar la superficie del administrador. No se afirma implementado CRUD de
los diez apartados pendientes ni se confunde ausencia de implementación con cero
registros. No se implementaron S02–S14 completos.

Se usa la base actual mientras el PO no indique otra fuente. Persistido significa
guardado en este entorno, no oficial ni verificado institucionalmente: hay datos
de pruebas previas y la cuenta ficticia solicitada por el usuario. No se cargaron
ni inventaron datos institucionales reales. Los grupos de 1 a 4 conservan el
display protegido del servidor; no se recalculan ni se revela su conteo exacto.
Ante error o pérdida de sesión no hay fallback a fixtures, ceros ni datos previos.

## Aplicación y verificación

Los cuatro servicios se encontraron detenidos el 14 de octubre y se iniciaron
sus mismos contenedores. Solo web se reconstruyó/reemplazó después por
`merdn-web:eloisa-real044`, conservando variables, puertos y red. API, PostgreSQL
e IdP conservaron sus IDs. PostgreSQL no recibió migraciones ni escrituras de
negocio; el flujo real de login/auditoría usa los mecanismos existentes.
Origen de la imagen web: `C:\Users\10plu\Eloisa-develop\eloisa_project`.
Configuraciones anteriores y evidencia de preservación están en backups privados
ignorados por Git; no copiar su contenido a incidencias o documentación.

- Suite web: 1849 casos/73 archivos correctos, cero omitidos; incluye tres casos
  útiles nuevos y ajuste de la frontera de consumidores al nuevo resumen.
- Rollback: tres casos Node correctos —campos previos ausentes, PUT ignorado,
  cambio fuera de presentación—. `node --test tests/identity/login-theme.test.mjs`.
- Typecheck web, build Docker, lint, scanner y diff-check correctos.
- E2E real con la misma cuenta: error de contraseña, login/callback/municipio,
  13 destinos, conteos UI iguales a API, Hospital denegado y logout confirmado.
- Fallo 503 inducido solo en el cliente de prueba: sin cifras/fallback; reintento
  recupera datos reales. Teclado/foco al navegar, login y panel con axe0, 320px
  sin desbordamiento y recursos del tema sin errores.
- Evidencia local: `.tmp/e2e043044-final.txt`, `.tmp/login043/`,
  `.tmp/web044-final.txt`, `.tmp/lint043044-final.txt` y
  `.tmp/secrets043044-final.txt`. Contienen resultados, no credenciales.
- Gate: 0 errores/19 advertencias históricas; validación estricta: 0/0.
  No se repite la baseline PostgreSQL intacta. El cambio obligatorio de contraseña
  no se disparó ni se resetearon cuentas para probarlo; sus plantillas padre y
  mecanismos se conservan, con evidencia funcional previa de 041.
- Revisión independiente focal cerrada sin bloqueantes tras comprobar fuente,
  resultados finales y capturas; correcciones de rollback verificadas.

Para revisar: abrir `http://127.0.0.1:3000/municipality`, iniciar sesión con la
cuenta de prueba ya entregada y comprobar Inicio, Población y Territorio. El
registro inicial municipal permanece cerrado. No se publican estos cambios ni se
integran main/develop en esta entrega local.
