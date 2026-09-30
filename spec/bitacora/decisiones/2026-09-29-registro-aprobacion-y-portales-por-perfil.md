# Decisión — registro, aprobación hospitalaria y portal por perfil
## Fecha

2026-09-29

## Decisión del Product Owner

El entorno funcional de pruebas debe permitir que personas ficticias se
registren como Paciente, Cuidador o Visitador médico. Las solicitudes de los
tres perfiles se envían al Hospital y requieren aprobación antes de que la
persona pueda entrar al apartado correspondiente.

Además de los Pacientes de prueba, el entorno debe incluir Cuidadores y
Visitadores médicos ficticios que permitan revisar el recorrido completo y sus
respectivas experiencias de usuario.

## Correspondencia canónica

| Texto visible | Valor técnico | Experiencia de referencia |
|---|---|---|
| Paciente | `PATIENT` | `prototype-claude/Eligeme-Paciente.dc.html` |
| Cuidador | `CAREGIVER` | `prototype-claude/Eligeme-Cuidador.dc.html` |
| Visitador médico | `FIELD_PROFESSIONAL` | `prototype-claude/Eligeme-Profesional.dc.html` |

Los archivos del prototipo son referencias visuales y funcionales de solo
lectura. La aplicación funcional se implementa fuera de `prototype-claude/`.

## Comportamiento obligatorio

1. El formulario público ofrece claramente los tres perfiles y crea una
   solicitud persistente `PENDING` con datos exclusivamente ficticios.
2. El Hospital muestra las solicitudes persistidas de los tres perfiles y
   permite identificarlas, buscarlas o filtrarlas por perfil y estado.
3. Hospital debe aprobar o rechazar cada solicitud. Un registro pendiente,
   rechazado, suspendido o revocado no permite entrar al portal solicitado.
4. Tras aprobación y provisión satisfactoria, la persona puede autenticarse y
   abrir únicamente su experiencia correspondiente:
   - Paciente: portal de Paciente.
   - Cuidador: portal de Cuidador.
   - Visitador médico: portal Profesional.
5. Los datos iniciales de prueba incluyen ejemplos deterministas de los tres
   perfiles para presentar y verificar el sistema.
6. Las listas visibles en Hospital deben usar datos persistidos como fuente de
   verdad. No se aceptan arreglos React, `localStorage` ni confirmaciones que se
   pierdan al recargar.
7. La aprobación de Cuidador no crea una relación con un Paciente. La aprobación
   de Visitador médico no crea una asignación de pacientes ni permisos clínicos.
   Esas autorizaciones siguen siendo relaciones separadas.
8. Todas las superficies identifican los registros como «Datos ficticios de
   prueba» y no admiten datos reales.

## Orden de implementación

- MP02 completa el registro público para los tres perfiles.
- MP03 sustituye la bandeja simulada de Hospital por solicitudes persistentes y
  decisiones reales dentro del tenant de prueba.
- MP04 implementa provisión, autenticación y bloqueo de acceso según estado,
  junto con el enrutamiento al portal de cada perfil.
- MP05 crea los datos deterministas de Pacientes, Cuidadores y Visitadores
  médicos de prueba y el reinicio seguro del entorno.
- MP06 verifica de extremo a extremo los tres recorridos.

## Evidencia de la decisión

Instrucción explícita del Product Owner en la sesión del 2026-09-29: los
Cuidadores y Visitadores médicos deben poder registrarse igual que los
Pacientes, aparecer como datos de prueba, enviarse al Hospital para aprobación
y permanecer sin acceso hasta ser aceptados.
