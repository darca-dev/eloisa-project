# Investigación 035 — Acceso central y aprobación institucional

> Actualización 2026-09-23: estos hallazgos describen una futura implementación
> productiva. La Product Owner aclaró que la etapa vigente usa exclusivamente
> usuarios y datos ficticios; por ello `/acceso` no consume ninguna sesión ni
> API existente.

## Hallazgos

- Hospital ya consulta y abre una sesión institucional; el cliente no expone la
  cookie al frontend y falla cerrado si no hay sesión.
- Alcaldía también evalúa una sesión institucional y niega contenido si no hay
  autorización municipal.
- Paciente tiene sesión humana OIDC y self-scope; el registro no crea una
  cuenta ni debe reutilizarse como autenticación.
- Cuidador y Visitador cuentan hoy con registro o demos, pero no con identidad
  aprobada y persistente para autorizar una experiencia de negocio.

## Decisión derivada

El acceso central orquesta rutas de autenticación ya existentes y una nueva
decisión de aprobación; no crea un cuarto mecanismo de sesión ni permite que
el cliente afirme roles o instituciones.
