# Fidelidad visual de la inscripción con marca Eloisa

- Fecha: 2026-10-01
- Actor: Product Owner
- Spec relacionada: `038-demo-funcional-accesos-ficticios`
- Estado: Aprobada

## Decisión

Las tres ramas de inscripción de Atención Domiciliaria deben reproducir la
composición visual de `prototype-claude/Eligeme-Inscripcion.dc.html`. La única
sustitución de marca es `ELÍGEME` por `Eloisa`; se conservan la arquitectura
productiva, el registro persistente, los datos ficticios, la aprobación Hospital
y las restricciones de seguridad ya aprobadas.

La fidelidad comprende:

1. lienzo gris, columna central de 600 px y separación vertical uniforme;
2. encabezado azul con Elí circular, `Eloisa` y el subtítulo del prototipo;
3. tarjeta blanca de progreso independiente, con perfil, título del paso,
   `Paso N de 5` en rosa, barra de 8 px y cinco controles en una sola fila cuando
   exista espacio;
4. paso activo con fondo azul y texto blanco; pasos futuros con apariencia
   inactiva sin perder contraste ni semántica accesible;
5. tarjeta blanca separada para el contenido, con Elí a la izquierda y burbuja
   gris, etiqueta de sección en mayúsculas y campos con las proporciones,
   espaciados, radios, pesos y bordes de la referencia;
6. filas responsivas para nombres/apellidos y fecha/edad, manteniendo una sola
   columna cuando el ancho no permita dos;
7. los tres botones de datos ficticios de la rama permanecen disponibles, pero
   se integran dentro de la tarjeta del paso y usan el mismo lenguaje visual;
8. navegación, errores, foco, teclado, `aria-current`, labels, 320 px, limpieza
   de password y el POST único permanecen funcionales.

## Límites

- No copiar ni ejecutar el runtime del prototipo.
- No modificar `prototype-claude/`.
- No recuperar la marca `ELÍGEME`.
- No cambiar campos, catálogos, persistencia, API, permisos, tenant, auditoría,
  OIDC ni decisiones Hospital.
- La similitud visual no autoriza placeholders como sustituto de labels.

## Fuente

- Decisión expresa del Product Owner y comparación visual aportada el
  2026-10-01.
- `prototype-claude/Eligeme-Inscripcion.dc.html`, referencia protegida de solo
  lectura.
