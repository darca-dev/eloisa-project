# Alcance obligatorio por experiencia, conectividad e ingresos

Fecha: 2026-10-21. Autoridad: instrucción expresa del Product Owner en la conversación con Codex, posterior a la auditoría de la spec 055.

## Decisiones de producto confirmadas

1. **Hospital / semáforo:** conectado a bitácoras del cuidador y registros del visitador. Las alarmas automáticas dependen de los parámetros individuales que decide el visitador autorizado, incluida la cantidad de ocurrencias; no de umbrales generales inventados. La alarma manual aprobada anteriormente se conserva.
2. **Hospital / profesionales:** el Hospital autoriza y proporciona el código para operar tanto a su equipo como a profesionales particulares/externos. Debe existir postulación, selección y contratación o adhesión al programa hospitalario, incluida consulta virtual, con condiciones explícitas. La pertenencia declarada no reemplaza la autorización institucional.
3. **Hospital / sostenibilidad:** membresías, servicios y programas propios o gubernamentales son capacidades obligatorias, con creación/modificación de oferta, calendario claro para citas físicas, virtuales y domiciliarias, y trazabilidad del ingreso y flujo de caja.
4. **Hospital / reportes:** información clara, específica y trazable, reutilizable y editable mediante intercambio autorizado con programas externos, incluidos los de Supersalud o ADRES cuando corresponda. No se presume una integración aprobada ni se permite reescribir la fuente histórica sin trazabilidad.
5. **Alcaldía:** es el cliente principal. Su experiencia completa conserva prioridad y alcance; FURAG, ADRES y derecho al cuidado pueden comenzar como información conectada a fuentes públicas en línea. Los datos oficiales reales y específicos por municipio se conectarán cuando las entidades responsables autoricen el intercambio. Se preservan MIPG, evidencia, indicadores y demás dominios estratégicos.
6. **Profesional médico:** todas las capacidades representadas en su interfaz deben conservarse en el alcance funcional, incluida wallet para consultar pagos registrados. La inscripción debe distinguir equipo del Hospital de particular que se adhiere al programa, mostrando y registrando las condiciones aceptadas. No se aprueban por ello datos o reglas demostrativas del prototipo.
7. **Paciente/cuidador:** aplicación instalable que permita registrar trabajo sin conexión y sincronizarlo cuando el dispositivo vuelva a tener red, contemplando el uso durante la carga del teléfono. Debe existir wallet para consultar pagos e incentivos financieros registrados. La falta de conectividad no puede perder ni confirmar falsamente una operación.

## Aclaración expresa del PO sobre wallets

Ante la pregunta de Codex sobre recibir/retirar/transferir dinero real frente a consultar registros, el Product Owner eligió **«Solo consultar pagos e incentivos registrados»**. Aplica a profesionales, pacientes y cuidadores. La wallet es una vista personal autorizada de información registrada por Hospital/programa, con concepto, origen, estado, fecha y soporte cuando exista; no requiere un proveedor financiero ni habilita transferencias, retiros o custodia de dinero. Mostrar un pago registrado no equivale a que MERDN lo haya procesado ni acredita recepción bancaria sin soporte.

Estas decisiones fijan el resultado exigido; no convierten capacidades aún pendientes en entregadas ni reducen el producto a la spec 055. Matriz y criterios de cierre: `docs/plan-funcional/02-ALCANCE-OBLIGATORIO-POR-EXPERIENCIA.md`.

## Detalles materiales aún por especificar

- Wallet: concretar fuente autorizada de los registros, conceptos, moneda, beneficiario, estados/evidencia, correcciones, conciliación y permisos de consulta. Su naturaleza de consulta está decidida y no vuelve a quedar abierta. La incorporación de dinero real requeriría otra decisión y otro paquete.
- Trabajo sin conexión: dispositivos objetivo, mecanismo instalable, datos locales permitidos, protección y acceso local, vigencia, conflictos, sincronización y comportamiento de segundo plano. No se elige aplicación nativa o PWA por inferencia. Cargar el teléfono sin conectividad no puede enviar datos al Hospital.
- Profesional: significado exacto del código, emisor, alcance, expiración/revocación y contratos/condiciones por programa, sin sustituir autenticación ni acreditar competencia por un código.
- Comercial e institucional: tarifas, beneficios, cambios de membresía, financiación de programas, proveedor de video y contratos concretos de intercambio externo. Procesamiento real de pagos no forma parte de la wallet aprobada.

La aprobación del objetivo sin conexión no aprueba almacenar salud en localStorage ni relaja la seguridad. La spec 055 actual conserva su prohibición de almacenamiento clínico offline hasta un paquete específico suficiente y aprobado. Una entrada local pendiente no equivale a recepción, evaluación o revisión hospitalaria.

## Límites de la instrucción

Codex documenta y especifica; Claude implementa bajo contratos suficientes. No se autoriza por este registro procesar pagos productivos, custodiar dinero, usar datos reales, afirmar aprobación de entidades externas, modificar el prototipo, Git mutante ni despliegue. No se registra consentimiento SDD de paquetes nuevos ni se ejecuta confirm-user-consent.sh.
