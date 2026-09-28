# Plan 035 — Acceso central y aprobación institucional

> Actualización 2026-09-23: la aclaración posterior de la Product Owner deja
> sin efecto los pasos de API, migración, autenticación y autorización de este
> documento. La implementación vigente es únicamente una demostración local
> aislada de navegación y solicitudes ficticias.

## Fases

1. Añadir la entrada central y redirigir los accesos del Hub.
2. Mostrar las solicitudes ficticias y confirmar que no se persisten.
3. Verificar la interfaz, sus restricciones de demo y el build web.

## Dependencias

- Los canvases locales ya existentes de Hospital, Alcaldía, Cuidador y Personal
  de terreno.
- No depende de API, base de datos, OIDC, servicio externo ni credencial.

## Riesgos

- Confundir la demostración con un acceso real. Mitigación: copy explícito,
  pruebas que prohíben API/persistencia y ausencia de formularios de contraseña.
- Que un canvas parezca autorización. Mitigación: datos ficticios y aviso de
  demostración antes de cada navegación.

## Estrategia

1. Consolidar el enrutamiento de acceso central sin reemplazar las sesiones
   institucional y humana existentes.
2. Crear el agregado de solicitud de acceso con tenant, institución, persona,
   perfil solicitado, estado, decisiones y eventos de auditoría.
3. Exponer API protegida y bandeja institucional con autorización de servidor,
   RLS y prevención de autoaprobación.
4. Conectar el registro y los portales a la decisión vigente del servidor;
   conservar demos locales totalmente aisladas.
5. Cubrir flujos positivos, denegados, revocados, cross-tenant y accesibilidad
   antes de habilitar la navegación final.

## Migración y compatibilidad

- Migración Prisma aditiva y reversible solo si no hay solicitudes dependientes.
- Las sesiones institucionales actuales siguen vigentes; no se reescriben ni
  se comparten con sesión humana.
- Paciente conserva el cliente OIDC actual. Cuidador y Visitador no reciben una
  ruta de negocio hasta que exista aprobación vigente confirmada por servidor.

## Riesgos y mitigación

- Autoaprobación o aprobación cross-tenant: autorización y filtro en API/DB,
  pruebas negativas y auditoría.
- Enumeración de identidades: mensajes neutrales para solicitante y sin datos
  de persona en errores.
- Confundir demo con acceso real: sesión y datos demo aislados; ningún fixture
  puede abrir APIs o rutas protegidas.
- Revocación sin efecto: comprobar vigencia en cada operación sensible y
  pruebas de sesión/permiso denegado.
