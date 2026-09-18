# H-FID-B - Branding e identidad visual del shell Hospital

## 1. Identificacion

- **Task ID:** `H-FID-B`
- **Titulo:** Branding Eloisa, identidad institucional y compactacion del topbar Hospital
- **Estado:** READY FOR CLAUDE
- **Prioridad:** Fidelity checkpoint 2 de 3
- **Precedencia:** `H-FID-A` validado en `056e8e7`
- **Tiempo maximo de implementacion:** 15 minutos
- **Autoridad:** Product Owner, instruccion `PREPARE H-FID-B`

## 2. Objetivo

Recuperar la identidad visual aprobada del shell Hospital integrando el corazon canonico junto
a Eloisa, separando claramente la marca de plataforma de la identidad de cada institucion,
corrigiendo metadatos institucionales incompletos y compactando el topbar sin cambiar ninguna
operacion, permiso, sesion o fuente de datos.

## 3. Baseline vinculante

1. `H-FID-A` ya esta validado, committed y pushed en `056e8e7`.
2. El shell neutral de `consultando` y `sin-sesion`, su navegacion bloqueada y su comportamiento
   fail-closed no se redisenan en esta Task.
3. Eloisa es la marca visible definitiva.
4. El asset canonico existente es:
   `apps/web/public/brand/corazon-check.png`.
5. El logo Eloisa y el logo institucional son identidades diferentes y no pueden sustituirse
   entre si.

## 4. Resultado obligatorio

### 4.1 Marca Eloisa

1. Integrar el corazon canonico junto al nombre Eloisa en la identidad de plataforma del
   sidebar Hospital.
2. Reutilizar el asset existente sin copiarlo, editarlo, renombrarlo ni crear una variante.
3. Mantener un nombre accesible correcto y evitar que imagen y texto produzcan una lectura
   duplicada o ambigua.
4. Conservar la densidad, jerarquia, ancho y orden visual del sidebar aprobado.

### 4.2 Identidad institucional

1. Mantener el logo institucional como una ranura separada del logo Eloisa.
2. Renderizar el logo institucional solo cuando exista una fuente autorizada.
3. No inventar ni usar como fallback un logo, nombre, tipo o municipio institucional.
4. Componer `tipo` y `municipio` de esta forma:
   - ambos vacios: no renderizar metadato ni separador;
   - solo tipo: renderizar solo tipo;
   - solo municipio: renderizar solo municipio;
   - ambos presentes: renderizar exactamente `tipo · municipio`.
5. No dejar `·`, espacios o nodos vacios huerfanos.

### 4.3 Topbar autenticado

1. Compactar visualmente el conjunto de perfil institucional y acciones de sesion para
   recuperar equilibrio y densidad.
2. Conservar exactamente los handlers y resultados de `Cambiar sesion` y `Cerrar sesion`.
3. Mantener buscador, actor institucional, rol efectivo, caducidad accesible y estados de
   ocupado que ya tengan fuente real.
4. Ocultar campana, badge o conteo de novedades cuando no exista una fuente real.
5. No sustituir el conteo ausente por cero, placeholder, badge neutral o fixture.

### 4.4 Navegacion

Conservar exactamente estos 12 elementos y su orden:

1. Inicio
2. Agenda y citas
3. Pacientes
4. Semaforo de alarmas
5. Profesionales
6. Visitas domiciliarias
7. Consultas virtuales
8. Calificaciones
9. Novedades
10. Gestion financiera
11. Reportes
12. Configuracion

La Task no cambia destinos, handlers, permisos, estado activo, separador de zona ni
comportamiento de navegacion.

## 5. Isa

No agregar a Isa, su personaje, burbuja, texto, imagen o una interaccion nueva en Hospital.
Que el asset canonico de Isa exista no autoriza a ubicarlo arbitrariamente en esta superficie.

## 6. Seguridad, datos y funcionalidad - invariantes

1. No cambiar API, PostgreSQL, Prisma, migraciones, RLS, tenancy ni auditoria.
2. No cambiar sesiones, cookies, CSRF, apertura, cierre, reconfirmacion o revocacion.
3. No cambiar roles Viewer/Scheduler ni permisos de ninguna vista o accion.
4. No montar contenido o datos antes de una sesion confirmada.
5. No restaurar fixtures, conteos, instituciones o personas demostrativas.
6. No cambiar clientes, contratos, fetch, rutas, persistencia o logica de navegacion.
7. Visibilidad estructural no equivale a autorizacion.

## 7. Allowlist cerrada

Claude puede modificar exclusivamente:

1. `apps/web/src/features/hospital/HospitalSidebar.tsx`
2. `apps/web/src/features/hospital/HospitalTopbar.tsx`
3. `apps/web/src/features/hospital/HospitalShell.tsx`
4. `apps/web/src/features/hospital/hospital.module.css`
5. `apps/web/src/features/hospital/hospitalShell.test.tsx`
6. `apps/web/src/features/hospital/hospitalNavegacion.test.tsx`

El sexto archivo queda autorizado exclusivamente para:

1. retirar la expectativa `Novedades: 7 sin leer`;
2. actualizar la descripcion heredada que exige la campana o el conteo demostrativo.

No puede usarse para cambiar orden, destinos, handlers, permisos, estados activos, alcance de
navegacion ni ninguna otra expectativa.

Asset autorizado solo para lectura y uso, no para modificacion:

- `apps/web/public/brand/corazon-check.png`

Si la implementacion requiere un septimo archivo o modificar el asset, debe detenerse y
reportarlo. No puede ampliar la allowlist silenciosamente.

## 8. Fuera de alcance

- `branding.ts`, `hospitalConfig.ts` y cualquier otro config.
- Componentes compartidos de marca o assets publicos.
- H-FID-C y la purga general de copy tecnico.
- Contenido, estilos o logica de modulos Hospital.
- Reportes y modulos diferidos.
- Nuevas capacidades, nuevos datos o nuevas interacciones.
- Dependencias, configuracion, infraestructura, Identity y herramientas locales.
- Tests visuales golden, pixel diff o redisenos generales.
- Commit, push, merge, deploy o release.

## 9. Criterios de aceptacion

1. El sidebar muestra el corazon canonico existente junto a Eloisa.
2. La marca de plataforma y el logo institucional son elementos separados.
3. Un logo institucional solo aparece si la institucion lo aporta.
4. Las cuatro combinaciones de tipo/municipio se renderizan sin separadores o espacios
   huerfanos.
5. El topbar autenticado conserva buscador, perfil y las dos acciones de sesion con sus
   handlers originales.
6. No se renderiza `Novedades: 7`, una campana o un conteo demostrativo sin fuente.
7. Los 12 elementos del menu permanecen en el orden vinculante.
8. H-FID-A sigue mostrando shell neutral fail-closed en `consultando` y `sin-sesion`.
9. No aparecen institucion, persona, municipio, badges o conteos demo antes de autenticar.
10. Isa no se agrega a Hospital.
11. No hay cambios de backend, datos, permisos, sesion o logica funcional.
12. El diff final contiene exclusivamente archivos de la allowlist y no modifica el asset.

## 10. Pruebas rapidas obligatorias

Ejecutar:

```text
npm.cmd run test --workspace @merdn/web -- --run src/features/hospital/hospitalShell.test.tsx src/features/hospital/hospitalNavegacion.test.tsx
git diff --check
```

Cubrir como minimo:

1. ruta exacta `/brand/corazon-check.png` y nombre accesible Eloisa;
2. logo institucional ausente sin fuente y separado cuando se aporta;
3. tipo/municipio con cero, uno y dos valores;
4. ausencia de ` · ` y de nodos de metadato vacios;
5. dos botones de sesion, mismos handlers y estado disabled durante operacion;
6. ausencia del conteo demostrativo `7` y de su anuncio accesible;
7. orden exacto de los 12 elementos;
8. regresion de los estados neutral, sin sesion y autenticado de H-FID-A;
9. ausencia de Isa y de cambios funcionales.

## 11. Stop conditions

Detenerse sin ampliar alcance si:

1. se necesita modificar un archivo fuera de la allowlist;
2. se necesita modificar o reemplazar el asset canonico;
3. compactar el topbar exige cambiar handlers, sesion, permisos o contratos;
4. ocultar el conteo exige inventar una fuente o cambiar backend;
5. se pretende agregar Isa sin una ubicacion aprobada;
6. una prueba de H-FID-A o de navegacion falla por la solucion propuesta;
7. el trabajo no puede completarse dentro de 15 minutos.

## 12. Handoff requerido

Claude debe devolver:

1. lista exacta de archivos modificados;
2. resumen de marca, identidad institucional, topbar y navegacion;
3. evidencia de las cuatro combinaciones tipo/municipio;
4. confirmacion de ausencia de badge/conteo demo y de Isa;
5. confirmacion de handlers, sesion, roles, backend y modulos intactos;
6. comandos y resultados de pruebas;
7. diff de alcance, riesgos y cualquier desviacion;
8. `STOP` si excede tiempo, allowlist o decisiones fijadas.

---

H-FID-B SAFE TO IMPLEMENT: YES

H-FID-B MAXIMUM CLAUDE TIME: 15 MINUTES
