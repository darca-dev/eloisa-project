# Decisión — portal unificado y autenticación local por perfil
## Fecha

2026-09-29

## Decisión del Product Owner

La página principal de Eloísa se unifica como punto de entrada para Atención
Domiciliaria, Hospital y Alcaldía. Las tres experiencias utilizan un mismo
proveedor local de identidad con cuentas exclusivamente ficticias, pero cada
superficie acepta únicamente los perfiles autorizados para ella.

La demostración debe permitir iniciar sesión con cuentas ficticias conocidas,
mostrar un error claro cuando una cuenta intenta entrar por una superficie que
no corresponde y dirigir cada identidad aprobada a su experiencia autorizada.

## Adaptación a la arquitectura vigente

La idea funcional se implementa sobre la arquitectura OIDC ya aprobada:

1. Keycloak local es el proveedor único de identidad para esta especificación.
2. La aplicación usa un adaptador compartido de inicio/cierre y resolución de
   sesión; no usa un arreglo JavaScript como fuente de usuarios.
3. Las contraseñas ficticias existen únicamente en el realm local y en
   configuración o variables locales ignoradas por Git. Nunca se persisten en
   MERDN, código fuente, base de negocio, auditoría o logs.
4. El backend deriva identidad, perfil, tenant y capacidades desde la sesión y
   la base. La interfaz no concede permisos por ocultar o mostrar una pantalla.
5. Firebase no se adopta mediante esta decisión. Un proveedor futuro podrá
   reemplazar el adaptador de identidad mediante una decisión arquitectónica
   separada, sin cambiar el contrato de autorización de las superficies.

## Navegación unificada

La portada `/` ofrece tres entradas:

| Entrada visible | Acceso | Destino después de autenticación autorizada |
|---|---|---|
| Atención Domiciliaria | Acceso humano compartido | `/paciente`, `/cuidador` o `/profesional` según contexto aprobado |
| Hospital | Variante institucional Hospital | `/hospital` |
| Alcaldía | Variante institucional Alcaldía | `/municipality` |

La implementación puede reutilizar `/acceso` y sus variantes de destino en vez
de duplicar tres servicios de autenticación. Las rutas visuales separadas son
fachadas de una misma integración OIDC; no contienen listas propias de usuarios.

`FIELD_PROFESSIONAL` se presenta al usuario como «Visitador médico» y abre la
experiencia `/profesional`. No se crea una ruta o un rol paralelo `visitor`.

## Cuentas de prueba

El dataset determinista de MP05 incluirá al menos:

- una cuenta Paciente aprobada;
- una cuenta Cuidador aprobada, sin relación automática con pacientes;
- una cuenta Visitador médico aprobada, sin asignaciones automáticas;
- una identidad revisora del Hospital;
- una identidad institucional de Alcaldía.

Los identificadores concretos y contraseñas no forman parte de este documento ni
del repositorio. Se generan o cargan desde configuración local durante el seed.

## Registro y aprobación

1. Las cuentas humanas precargadas están aprobadas para que la presentación
   pueda recorrer los tres portales inmediatamente.
2. Una nueva persona ficticia usa «Registrarme / solicitar acceso» y crea una
   solicitud `PENDING`.
3. Mientras la solicitud no llegue a `APPROVED` después de la provisión OIDC,
   el inicio de sesión no concede el contexto solicitado.
4. Hospital revisa y decide solicitudes de Paciente, Cuidador y Visitador médico.
5. Una aprobación habilita únicamente el perfil solicitado. No crea relación
   Cuidador–Paciente, asignación profesional ni acceso clínico adicional.
6. Rechazo, suspensión o revocación impiden el acceso según la máquina de estados
   de SPEC 038.
7. Las identidades institucionales de Hospital y Alcaldía son precargadas por el
   entorno; no usan el formulario público de solicitud humana.

## Restricción por superficie

- El acceso humano acepta únicamente contextos aprobados de Paciente, Cuidador
  o Visitador médico y redirige al portal correspondiente.
- Hospital exige una identidad institucional y la capacidad concreta requerida.
- Alcaldía exige una identidad institucional municipal.
- Una cuenta válida presentada en la superficie equivocada recibe un mensaje
  neutral de falta de autorización y no se redirige al portal solicitado.
- Esta comprobación se aplica en backend y en cada API protegida, además del
  enrutamiento de la interfaz.

## Ayuda de presentación

Las pantallas pueden mostrar «Datos de prueba» y un botón «Usar cuenta de
prueba» solamente cuando una configuración explícita del servidor habilite el
modo local. Esa ayuda:

1. no se activa por query string ni por estado del navegador;
2. no existe en entornos distintos al local de prueba;
3. puede completar credenciales ficticias entregadas desde configuración local;
4. nunca guarda la contraseña en `localStorage`, `sessionStorage`, cookies
   legibles por JavaScript, código fuente, telemetría o logs;
5. mantiene visible que todos los usuarios y datos son ficticios.

## Evidencia de la decisión

Instrucción del Product Owner en la sesión del 2026-09-29: unificar la página
principal, ofrecer accesos para Atención Domiciliaria, Hospital y Alcaldía,
utilizar credenciales locales ficticias con restricciones por perfil, redirigir
al portal correspondiente y facilitar las cuentas durante la presentación.
