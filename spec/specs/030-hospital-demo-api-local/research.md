# Investigación NNN - Nombre

## Hallazgos

- La spec 026 cubre solo apariencia y prohíbe API, datos y autenticación.
- Agenda, Pacientes y Profesionales son las superficies Hospital que consultan
  datos institucionales desde el frontend.
- `HospitalAgenda` permite inyectar un DTO para pruebas, pero su runtime
  institucional no puede tener fallback: la fuente demo debe entrar solo desde
  la ruta demostrativa.

## Decisiones derivadas de los hallazgos

- No se crea servidor HTTP falso, endpoint público, contenedor, CORS, seed ni
  bypass de API. La interfaz «API demo» será un proveedor local tipado.
- No se reutilizan fixtures del prototipo que contienen datos clínicos, pagos,
  direcciones o instituciones ficticias antiguas.
- Este primer paquete cubre Agenda, Pacientes y Profesionales; otra superficie
  requiere inventario y ampliación explícita de la spec.
