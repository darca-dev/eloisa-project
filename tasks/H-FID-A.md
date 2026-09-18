# H-FID-A - Acceso institucional integrado al shell Hospital

## 1. Identificacion

- **Task ID:** `H-FID-A`
- **Titulo:** Acceso institucional integrado visualmente al shell Hospital
- **Estado:** READY FOR CLAUDE
- **Prioridad:** Fidelity checkpoint 1 de 3
- **Tiempo maximo de implementacion:** 15 minutos
- **Autoridad:** Product Owner, instruccion `PRE-FIDELITY CHECKPOINT`

## 2. Objetivo

Recuperar la continuidad visual del Hospital aprobado cuando la sesion institucional esta
en comprobacion o ausente. El acceso debe vivir dentro de la geometria reconocible del shell
Hospital y no parecer una aplicacion aislada, sin relajar el comportamiento fail-closed ni
mostrar datos institucionales, personales, operativos o demostrativos.

## 3. Resultado obligatorio

### 3.1 Estado `consultando`

1. Conservar la envolvente y densidad estructural Hospital: sidebar neutral y area principal.
2. Mostrar el estado de comprobacion dentro del area principal y anunciarlo con semantica de
   estado accesible.
3. No mostrar todavia el formulario de acceso.
4. No montar topbar funcional, buscador, campana, perfil, contenido de modulos ni
   `data-hospital-content`.

### 3.2 Estado `sin-sesion`

1. Conservar la misma envolvente Hospital.
2. Mostrar un sidebar neutral con marca y las etiquetas del menu en el orden aprobado.
3. La navegacion neutral debe estar bloqueada: sin handlers, rutas, cambios de vista ni
   apariencia de permiso concedido.
4. Omitir badges, conteos, institucion, tipo, municipio, persona, iniciales y cualquier dato
   procedente de `hospitalShellDemo`.
5. Integrar el formulario de acceso en el area principal del shell, no en una tarjeta que
   ocupe una aplicacion visual separada.
6. Mantener labels, region viva, estados de ocupado y errores no enumerativos.

### 3.3 Estado autenticado

No cambiar su navegacion, modulos, datos, permisos, topbar ni comportamiento funcional.

## 4. Seguridad y datos - invariantes

1. No montar modulos ni datos factuales antes de una sesion confirmada por `current`.
2. No usar fixtures ni `hospitalShellDemo` como fuente factual o fallback.
3. No enviar tenant, rol, actor, token ni campos adicionales desde el navegador.
4. Mantener el envio exclusivo de `identityCode` y `accessSecret` mediante el cliente
   existente.
5. Mantener el borrado de la credencial del estado en el mismo gesto de envio.
6. No cambiar cookie `HttpOnly`, same-origin/CSRF, revocacion, reconfirmacion, expiracion ni
   limpieza fail-closed.
7. Visibilidad estructural no equivale a autorizacion; los guards y el servidor siguen siendo
   la autoridad.

## 5. Allowlist cerrada

Claude puede modificar exclusivamente:

1. `apps/web/src/features/hospital/HospitalShell.tsx`
2. `apps/web/src/features/hospital/HospitalSidebar.tsx`
3. `apps/web/src/features/hospital/hospital.module.css`
4. `apps/web/src/features/hospital/hospitalShell.test.tsx`

Puede leer otros archivos y ejecutar pruebas existentes, pero no modificarlos. Si necesita un
quinto archivo, debe detenerse y reportar el motivo.

## 6. Fuera de alcance

- `hospitalInstitutionClient.ts` y su contrato.
- El cambio pendiente existente en `hospitalInstitutionClient.test.ts`.
- API, PostgreSQL, Prisma, migraciones, RLS, sesiones, cookies, CSRF y roles.
- Hospital autenticado, topbar autenticado y contenido de cualquier modulo.
- Branding detallado, logo canonico, separadores institucionales y limpieza del topbar, que
  pertenecen a `H-FID-B`.
- Purga general de copy tecnico, que pertenece a `H-FID-C`.
- Reportes y modulos diferidos.
- Fixtures, dependencias, configuracion, Identity y herramientas locales.
- Commits, push, merge, deploy o cambios de goldens.

## 7. Criterios de aceptacion

1. `consultando` renderiza shell neutral, sidebar y area principal, pero no formulario ni
   topbar funcional.
2. `sin-sesion` renderiza shell neutral y formulario integrado en el area principal.
3. Los dos estados carecen de tenant, institucion, municipio, persona, iniciales, badges,
   conteos, KPIs, filas y datos demostrativos.
4. El menu neutral conserva sus etiquetas y orden, pero no navega ni monta modulos.
5. No existe `data-hospital-content` antes de autenticar.
6. El formulario conserva labels, password, `autocomplete="off"`, estado ocupado y region
   viva.
7. No aparecen `action`, `method`, URL, tenant, rol, actor, token o secreto renderizado.
8. La credencial continua borrandose al enviar y la identidad solo se publica despues de la
   confirmacion de sesion existente.
9. El estado autenticado y sus pruebas no sufren regresion.
10. El diff final contiene exclusivamente los cuatro archivos de la allowlist.

## 8. Pruebas rapidas obligatorias

Ejecutar:

```text
npm.cmd run test --workspace @merdn/web -- --run src/features/hospital/hospitalShell.test.tsx src/features/hospital/hospitalInstitutionClient.test.ts
git diff --check
```

En `hospitalShell.test.tsx`, cubrir como minimo:

- shell, `aside` y `main` neutrales en `consultando` y `sin-sesion`;
- ausencia de `header`, `data-hospital-content`, badges y datos demo;
- menu presente, ordenado e inerte;
- formulario ausente durante comprobacion y presente sin sesion;
- preservacion de labels, region viva y negativos de seguridad;
- regresion del shell autenticado.

`hospitalInstitutionClient.test.ts` tiene cambios pendientes de otro workstream en el
checkpoint actual: se ejecuta como regresion, pero no se modifica ni se incluye en el diff de
H-FID-A.

## 9. Stop conditions

Detenerse sin ampliar alcance si:

1. se necesita modificar un archivo fuera de la allowlist;
2. la solucion requiere montar topbar funcional o modulos sin sesion;
3. se necesita reutilizar identidad, badges, conteos o fixtures demostrativos;
4. se requiere cambiar cliente, API, sesion, RLS, permisos o contratos;
5. una prueba falla por cambios pendientes de otro workstream y no por H-FID-A;
6. el trabajo no puede completarse dentro de 15 minutos.

## 10. Handoff requerido

Claude debe devolver:

1. lista exacta de archivos modificados;
2. resumen por estado `consultando`, `sin-sesion` y autenticado;
3. confirmacion de invariantes de seguridad y ausencia de fixtures;
4. comandos y resultados de pruebas;
5. diff de alcance y cualquier riesgo o desviacion;
6. `STOP` si excede tiempo, allowlist o decisiones fijadas.

---

H-FID-A SAFE TO IMPLEMENT: YES

H-FID-A MAXIMUM CLAUDE TIME: 15 MINUTES
