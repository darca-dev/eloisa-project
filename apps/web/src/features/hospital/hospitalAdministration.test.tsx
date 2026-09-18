import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding } from '@/config/branding';

import {
  HOSPITAL_ADMIN_ESTADOS_ACCION,
  HOSPITAL_ADMIN_PESTANAS,
  HOSPITAL_ADMIN_PESTANA_INICIAL,
  HOSPITAL_ESTADOS_INTEGRACION,
  HOSPITAL_TIPOS_PERSONAL,
  esPestanaAdministracion,
  hospitalAdministracionDemo,
} from './hospitalAdministrationConfig';
import type { HospitalAdminPestanaId } from './hospitalAdministrationConfig';
import { HOSPITAL_NAV_ITEMS } from './hospitalConfig';
import { HospitalMemberships } from './HospitalMemberships';
import { HospitalShell } from './HospitalShell';
import { hospitalProfesionalesCore } from './hospitalProfessionalsConfig';
import { SESION_INSTITUCIONAL_FICTICIA, apariciones, main, texto } from './hospitalTestUtils';
import { destinoDeItem } from './hospitalViews';

/**
 * Administración institucional (TASK-003H-05, T-02 a T-19).
 *
 * Las vistas se renderizan con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom ni una librería de testing con DOM
 * y esta tarea no autoriza añadir dependencias. Por eso se verifica el marcado
 * renderizado, la configuración tipada y la lógica de navegación extraída como
 * funciones puras y como propiedades de montaje. La activación real por clic y
 * por teclado queda pendiente y se reporta como no ejecutada.
 */

const CONFIG = hospitalAdministracionDemo;

/** Identificador del buscador local de «Personal y accesos». */
const BUSCADOR_ID = 'hospital-admin-personal-buscador';

/** Shell montado directamente en la pestaña administrativa indicada. */
function admin(pestana: HospitalAdminPestanaId = HOSPITAL_ADMIN_PESTANA_INICIAL): string {
  return renderToStaticMarkup(
    <HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} vistaInicial="administracion" pestanaAdministracionInicial={pestana} />,
  );
}

/** Texto visible del área de contenido para esa pestaña. */
function contenido(pestana: HospitalAdminPestanaId = HOSPITAL_ADMIN_PESTANA_INICIAL): string {
  return texto(main(admin(pestana)));
}

/* ========================================================================== */
/* T-02 y T-03 — Navegación                                                   */
/* ========================================================================== */

describe('T-02 — «Configuración» es el único acceso del menú a Administración', () => {
  it('«Configuración» abre el contenedor y parte de «Membresías»', () => {
    expect(destinoDeItem('configuracion')).toEqual({ vista: 'administracion' });
    expect(HOSPITAL_ADMIN_PESTANA_INICIAL).toBe('Membresías');
    expect(contenido()).toContain('Planes de membresía');
  });

  it('«Membresías y servicios» ya no es una opción del menú', () => {
    // Decisión final de la Product Owner: vive dentro de Configuración.
    expect(HOSPITAL_NAV_ITEMS.map((item) => item.id)).not.toContain('membresias');
    expect(HOSPITAL_NAV_ITEMS.map((item) => item.etiqueta)).not.toContain(
      'Membresías y servicios',
    );
    expect(destinoDeItem('membresias')).toBeNull();
  });

  it('no crea ruta nueva, enlace, formulario, script ni recurso remoto', () => {
    for (const pestana of HOSPITAL_ADMIN_PESTANAS) {
      const html = admin(pestana);

      expect(html).not.toContain('href');
      expect(html).not.toContain('<form');
      expect(html).not.toContain('<script');
      expect(html).not.toContain('http://');
      expect(html).not.toContain('https://');
    }
  });
});

/** Las siete vistas/bloques autorizados y la pestaña que los monta (AC-04). */
const BLOQUES_AUTORIZADOS: readonly (readonly [string, HospitalAdminPestanaId, string])[] = [
  ['Membresías y servicios', 'Membresías', 'Planes de membresía'],
  ['Información clínica institucional', 'Historia clínica', 'Información clínica institucional'],
  ['Personal', 'Personal y accesos', 'Personal y accesos'],
  ['Roles y permisos', 'Roles y permisos', 'Roles y permisos'],
  ['Configuración institucional — agenda', 'Agenda y servicios', 'Agenda y servicios'],
  ['Configuración institucional — institución', 'Institución e integraciones', 'Datos de la institución'],
  ['Integraciones', 'Institución e integraciones', 'Integraciones'],
  ['Auditoría', 'Auditoría', 'Auditoría del sistema'],
];

describe('T-03 — Pestañas del contenedor', () => {
  it.each(BLOQUES_AUTORIZADOS)('%s se alcanza desde la navegación administrativa', (
    _bloque,
    pestana,
    encabezado,
  ) => {
    expect(contenido(pestana)).toContain(encabezado);
  });

  it('declara exactamente las siete pestañas autorizadas, con «Roles y permisos» separada', () => {
    expect([...HOSPITAL_ADMIN_PESTANAS]).toEqual([
      'Membresías',
      'Historia clínica',
      'Personal y accesos',
      'Roles y permisos',
      'Agenda y servicios',
      'Institución e integraciones',
      'Auditoría',
    ]);

    for (const pestana of HOSPITAL_ADMIN_PESTANAS) {
      expect(esPestanaAdministracion(pestana)).toBe(true);
    }
    expect(esPestanaAdministracion('Novedades')).toBe(false);
    expect(esPestanaAdministracion('Semáforo y alertas')).toBe(false);
  });

  it.each(HOSPITAL_ADMIN_PESTANAS)('%s monta un solo bloque y anuncia su estado', (pestana) => {
    const html = admin(pestana);

    expect(html).toContain(`data-hospital-admin="${pestana}"`);
    expect(apariciones(html, /data-hospital-admin=/gu)).toBe(1);
    expect(apariciones(html, /data-hospital-pestana="activa"/gu)).toBe(1);
    expect(apariciones(html, /data-hospital-pestana="inactiva"/gu)).toBe(
      HOSPITAL_ADMIN_PESTANAS.length - 1,
    );
    expect(apariciones(html, /aria-pressed="true"/gu)).toBe(1);
    expect(apariciones(main(html), /<h1\b/gu)).toBe(1);
    expect(apariciones(html, /<main\b/gu)).toBe(1);
  });

  it('las pestañas son botones reales enlazados con el panel', () => {
    const html = admin();

    expect(apariciones(html, /aria-controls="hospital-administracion-panel"/gu)).toBe(
      HOSPITAL_ADMIN_PESTANAS.length,
    );
    expect(html).toContain('id="hospital-administracion-panel"');
  });

  it('no reimplementa «Novedades» ni «Semáforo y alertas» del prototipo', () => {
    for (const pestana of HOSPITAL_ADMIN_PESTANAS) {
      const visible = contenido(pestana);

      expect(visible).not.toContain('Crear novedad');
      expect(visible).not.toContain('Semáforo y alertas');
      expect(visible).not.toContain('Presión sistólica');
      expect(visible).not.toContain('Saturación de oxígeno');
    }
  });
});

/* ========================================================================== */
/* T-04 y T-05 — Membresías y servicios                                       */
/* ========================================================================== */

describe('T-04 — Fidelidad de Membresías', () => {
  const visible = contenido('Membresías');

  it('muestra los tres planes con valor, periodicidad, estado y versión', () => {
    expect(CONFIG.membresias.planes).toHaveLength(3);

    for (const plan of CONFIG.membresias.planes) {
      expect(visible).toContain(plan.nombre);
      expect(visible).toContain(plan.visitas);
      expect(visible).toContain(plan.virtuales);
      expect(visible).toContain(plan.precio);
      expect(visible).toContain(plan.periodicidad);
      expect(visible).toContain(plan.estado);
      expect(visible).toContain(plan.version.etiqueta);

      for (const beneficio of plan.beneficios) {
        expect(visible).toContain(beneficio);
      }
      if (plan.descuento !== null) {
        expect(visible).toContain(plan.descuento);
      }
    }
    for (const etiqueta of Object.values(CONFIG.membresias.etiquetasPlan)) {
      expect(visible).toContain(etiqueta);
    }
  });

  it('cada plan ofrece «Editar plan» y abre el formulario visual aprobado', () => {
    const html = admin('Membresías');

    // Un «Editar plan» por plan, con su nombre en el texto accesible.
    expect(apariciones(html, />Editar plan</gu)).toBe(CONFIG.membresias.planes.length);
    for (const plan of CONFIG.membresias.planes) {
      expect(html).toContain(`— ${plan.nombre}`);
    }

    const abierto = texto(
      renderToStaticMarkup(
        <HospitalMemberships
          config={CONFIG.membresias}
          planEnEdicionInicial={CONFIG.membresias.planes[0]?.id}
        />,
      ),
    );

    expect(abierto).toContain(`${CONFIG.membresias.edicion.titulo}: Plan Básico`);
    for (const campo of CONFIG.membresias.edicion.campos) {
      expect(abierto).toContain(campo.etiqueta);
    }
    expect(abierto).toContain(CONFIG.membresias.edicion.cancelar);
    expect(abierto).toContain(CONFIG.membresias.edicion.guardar.etiqueta);
    expect(CONFIG.membresias.edicion.guardar.disponible).toBe(false);
  });

  it('muestra los seis servicios con precio, duración, profesional y cobertura', () => {
    expect(CONFIG.membresias.servicios.items).toHaveLength(6);

    for (const servicio of CONFIG.membresias.servicios.items) {
      expect(visible).toContain(servicio.nombre);
      expect(visible).toContain(servicio.precio);
      expect(visible).toContain(servicio.duracion);
      expect(visible).toContain(servicio.profesional);
      expect(visible).toContain(servicio.cobertura);
    }
  });

  it('reproduce el formulario «Crear membresía» con etiquetas asociadas', () => {
    const html = admin('Membresías');

    expect(visible).toContain('Crear membresía');
    expect(visible).toContain('Guardar plan');

    for (const campo of CONFIG.membresias.formulario.campos) {
      expect(visible).toContain(campo.etiqueta);
      expect(html).toContain(`for="hospital-admin-crear-membresia-${campo.id}"`);
      expect(html).toContain(`id="hospital-admin-crear-membresia-${campo.id}"`);
    }
  });
});

describe('T-05 — Alcance negativo de Membresías', () => {
  it('ninguna acción está habilitada y todas se rotulan como no implementadas', () => {
    const html = admin('Membresías');
    const acciones = html.match(/<button[^>]*data-hospital-accion="sin-implementar"[^>]*>/gu) ?? [];

    // «Guardar plan» es la única acción declarada como no implementada aquí:
    // «Editar plan» sí abre el formulario visual, que tampoco guarda nada.
    expect(acciones).toHaveLength(1);
    expect(CONFIG.membresias.formulario.accion.disponible).toBe(false);
    for (const boton of acciones) {
      expect(boton).toContain('disabled');
      expect(boton).not.toContain('onclick');
    }
  });

  it('declara los precios como datos ficticios y no ofrece compra ni cobro', () => {
    const visible = contenido('Membresías');

    expect(visible).toContain('datos ficticios de demostración');
    expect(visible).toContain('guarda, cobra, compra, afilia, renueva ni factura');
    expect(visible).not.toContain('Comprar');
    expect(visible).not.toContain('Pagar');
    expect(visible).not.toContain('Guardado');
    expect(visible).not.toContain('Plan actualizado');
  });
});

describe('T-17 — Gestión financiera no vive dentro de Configuración', () => {
  it('ninguna pestaña administrativa la nombra ni anticipa su alcance', () => {
    for (const pestana of HOSPITAL_ADMIN_PESTANAS) {
      const visible = contenido(pestana);

      expect(visible).not.toContain('Gestión financiera');
      /*
       * Un rol sí puede describir a qué accede («Presupuesto, gastos y
       * nómina»). Lo prohibido es que Configuración anticipe el contenido del
       * módulo financiero, que pertenece a TASK-003H-06.
       */
      for (const area of [
        'Cuentas de cobro',
        'Gastos operativos',
        'Insumos',
        'Presupuesto asignado',
        'Ejecución financiera',
        'Movimiento financiero',
        'Abrir Gestión financiera',
      ]) {
        expect(visible).not.toContain(area);
      }
    }
  });

  it('Membresías no importa ningún módulo financiero', () => {
    const codigo = readFileSync(
      fileURLToPath(new URL('./HospitalMemberships.tsx', import.meta.url)),
      'utf8',
    );

    expect(codigo).not.toContain('Financier');
    expect(codigo).not.toMatch(/from '\.\/hospitalFinan/u);
  });

  /*
   * TASK-003H-06 sustituye el destino provisional por el módulo financiero. La
   * comprobación conserva su intención original —«Gestión financiera» es un
   * módulo principal del menú, encima de «Reportes», y su contenido vive fuera
   * de Configuración— y actualiza únicamente lo que la nueva Task reemplaza.
   */
  it('es un módulo principal del menú y abre su propio módulo, no Configuración', () => {
    const financiera = HOSPITAL_NAV_ITEMS.find((item) => item.id === 'financiera');
    const posiciones = HOSPITAL_NAV_ITEMS.map((item) => item.id);
    const html = renderToStaticMarkup(<HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} vistaInicial="financiera" />);
    const visible = texto(main(html));

    expect(financiera?.etiqueta).toBe('Gestión financiera');
    expect(posiciones.slice(-3)).toEqual(['financiera', 'reportes', 'configuracion']);
    expect(visible).toContain('Gestión financiera');
    expect(visible).toContain('Resumen financiero');
    expect(visible).not.toContain('Módulo en preparación.');
    expect(main(html)).toContain('data-financiera-panel="resumen"');
    expect(main(html)).not.toContain('data-hospital-admin');
  });
});

/* ========================================================================== */
/* T-06, T-07 y T-08 — Información clínica institucional                      */
/* ========================================================================== */

describe('T-06 — Semántica de la información clínica', () => {
  const visible = contenido('Historia clínica');

  it('no se presenta como HCE completa ni como interoperabilidad activa', () => {
    expect(visible).toContain('no es una historia clínica electrónica');
    expect(visible).not.toContain('MERDN');
    expect(visible).toContain('ni sustituye la HCE de la institución');
    expect(visible).toContain('información clínica institucional autorizada o importada');
    expect(visible).toContain('no hay interoperabilidad');
  });

  it('conserva la composición y los fixtures del prototipo', () => {
    expect(visible).toContain('Datos estructurados');
    expect(visible).toContain('Documentos históricos');
    expect(visible).toContain('CSV · Excel · JSON · API');
    expect(visible).toContain('PDF · JPG · PNG');
    expect(visible).toContain('pacientes_hsr_2019_2026.csv');

    for (const conteo of CONFIG.clinica.resumen.items) {
      expect(visible).toContain(conteo.etiqueta);
      expect(visible).toContain(conteo.valor);
    }
  });

  it('rotula archivo, conteos y posible duplicado como ejemplo', () => {
    expect(visible).toContain('Ejemplo del prototipo');
    expect(visible).toContain('ningún archivo fue seleccionado ni leído');
    expect(visible).toContain('Conteos ficticios del prototipo');
    expect(visible).toContain('Paciente posiblemente existente (ejemplo)');
    expect(visible).toContain('no un resultado de deduplicación');
  });
});

describe('T-07 — Alcance negativo de la importación', () => {
  it('las siete acciones de importación están deshabilitadas', () => {
    const html = admin('Historia clínica');
    const acciones = html.match(/<button[^>]*data-hospital-accion="sin-implementar"[^>]*>/gu) ?? [];

    expect(acciones).toHaveLength(7);
    for (const boton of acciones) {
      expect(boton).toContain('disabled');
    }
    expect(html).not.toContain('type="file"');
  });

  it('no afirma ningún resultado de importación', () => {
    const visible = contenido('Historia clínica');

    expect(visible).not.toContain('Importación completada');
    expect(visible).not.toContain('Registros importados correctamente');
    expect(visible).not.toContain('Sincronizado');
  });
});

describe('T-08 — Procedencia clínica prevista', () => {
  it('nombra los metadatos futuros sin inventar ningún valor', () => {
    const visible = contenido('Historia clínica');
    const neutros = ['Por confirmar', 'No disponible en el prototipo'];

    expect(CONFIG.clinica.procedencia.campos).toHaveLength(9);
    for (const campo of CONFIG.clinica.procedencia.campos) {
      expect(visible).toContain(campo.etiqueta);
      expect(neutros).toContain(campo.estado);
    }
  });
});

/* ========================================================================== */
/* T-09, T-10, T-11 y T-12 — Personal, roles y relaciones                     */
/* ========================================================================== */

describe('T-09 — Fidelidad de Personal y accesos', () => {
  const visible = contenido('Personal y accesos');

  it('muestra las doce filas con código de personal, persona, rol, entidad y estado', () => {
    expect(CONFIG.personal.personal.items).toHaveLength(12);

    for (const persona of CONFIG.personal.personal.items) {
      expect(visible).toContain(persona.codigo);
      expect(visible).toContain(persona.nombre);
      expect(visible).toContain(persona.cargo);
      expect(visible).toContain(persona.rol);
      expect(visible).toContain(persona.entidad);
      expect(visible).toContain(persona.estadoAcceso);
    }
    for (const columna of CONFIG.personal.personal.columnas) {
      expect(visible).toContain(columna.etiqueta);
    }
    for (const estado of ['Activo', 'Pendiente', 'Suspendido', 'Bloqueado']) {
      expect(visible).toContain(estado);
    }
  });

  it('rotula el identificador como «Código de personal» y explica su generación', () => {
    expect(visible).toContain('CÓDIGO DE PERSONAL');
    expect(visible).toContain('Código de personal');
    expect(visible).toContain('El sistema genera automáticamente un código único de personal.');
    expect(visible).toContain('No es una contraseña ni sustituye a las credenciales');
  });

  it('conserva buscador, filtros y las cuatro vinculaciones del listado', () => {
    const html = admin('Personal y accesos');

    expect(visible).toContain(CONFIG.personal.busqueda.etiqueta);
    for (const filtro of Object.values(CONFIG.personal.busqueda.filtros)) {
      expect(visible).toContain(filtro);
    }
    for (const vinculacion of CONFIG.personal.vinculaciones.items) {
      expect(visible).toContain(vinculacion.etiqueta);
      expect(visible).toContain(vinculacion.plural);
    }
    expect(html).toContain(`for="${BUSCADOR_ID}"`);
    expect(html).toContain(`id="${BUSCADOR_ID}"`);
  });

  it('«Registrar persona» y cualquier acción quedan deshabilitadas', () => {
    const html = admin('Personal y accesos');
    const acciones = html.match(/<button[^>]*data-hospital-accion="sin-implementar"[^>]*>/gu) ?? [];

    expect(visible).toContain('Registrar persona');
    expect(acciones).toHaveLength(1);
    expect(acciones[0]).toContain('disabled');
  });

  it('no muestra, recupera ni permite cambiar ninguna contraseña', () => {
    const html = admin('Personal y accesos');

    expect(html).not.toContain('type="password"');
    expect(visible).not.toContain('Contraseña:');
    expect(CONFIG.personal.credenciales.aviso).toContain(
      'Ningún administrador puede ver una contraseña',
    );
    for (const accionCredencial of CONFIG.personal.credenciales.acciones) {
      expect(accionCredencial.disponible).toBe(false);
    }
  });
});

describe('T-10 — Personal es administrativo y no duplica Profesionales', () => {
  const visible = contenido('Personal y accesos');

  it('declara su propósito administrativo y remite la operación a Profesionales', () => {
    expect(visible).toContain('Vista administrativa');
    expect(visible).toContain('sigue viviendo en «Profesionales» y no se duplica aquí');
  });

  it('no reproduce agenda, atención, métricas ni la superficie de vinculación', () => {
    for (const operativo of [
      'Agenda del profesional',
      'Disponibilidad',
      'Ver agenda',
      'Atenciones del día',
      'Calificación promedio',
      'Modalidad de cobro',
      'Documentos de la vinculación',
    ]) {
      expect(visible).not.toContain(operativo);
    }
  });

  it('solo nombra «Vinculación y documentos» para remitir a Profesionales', () => {
    // Una única mención, dentro de la frase que explica dónde vive de verdad.
    expect(apariciones(admin('Personal y accesos'), /Vinculación y documentos/gu)).toBe(1);
    expect(visible).toContain(
      'calificaciones y «Vinculación y documentos»— sigue viviendo en «Profesionales»',
    );
  });

  it('la vista operativa «Profesionales» conserva su contenido aprobado', () => {
    const profesionales = texto(
      main(renderToStaticMarkup(<HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} vistaInicial="profesionales" />)),
    );

    // El directorio aprobado (spec 010) publica encabezado y nota contractuales
    // y advierte expresamente que no afirma disponibilidad.
    expect(profesionales).toContain(hospitalProfesionalesCore.encabezado.titulo);
    expect(profesionales).toContain(hospitalProfesionalesCore.encabezado.descripcion);
    expect(profesionales).toContain(hospitalProfesionalesCore.nota);
    expect(profesionales).toContain('no afirma disponibilidad');
    expect(profesionales).not.toContain('Disponibilidad');
  });
});

describe('T-12 — Tipos y relaciones institucionales', () => {
  const visible = contenido('Personal y accesos');

  it('contempla los cinco tipos de personal sin clasificar a las personas del ejemplo', () => {
    expect([...HOSPITAL_TIPOS_PERSONAL]).toEqual([
      'Profesional',
      'Cuidador vinculado',
      'Administrativo',
      'Operador',
      'Otro personal autorizado',
    ]);

    for (const tipo of HOSPITAL_TIPOS_PERSONAL) {
      expect(visible).toContain(tipo);
    }
    // Ninguna persona del listado recibe un tipo inventado: quedan sin fuente.
    expect(CONFIG.personal.vinculaciones.tiposEstado).toBe('Por confirmar');
  });

  it('mantiene interno, independiente, convenio y externo como relaciones distintas', () => {
    expect(CONFIG.personal.vinculaciones.items.map((item) => item.modalidad)).toEqual([
      'empleado',
      'independiente',
      'convenio',
      null,
    ]);
    expect(visible).toContain('Interno / empleado');
    expect(visible).toContain('Prestación de servicios / independiente');
    expect(visible).toContain('Tercero / convenio');
    expect(visible).toContain('Externo autorizado');
    expect(visible).toContain('no aplica legislación laboral');
    expect(visible).toContain(
      'no calcula salario, honorarios, seguridad social ni retenciones',
    );
  });
});

describe('T-11 — Roles y permisos', () => {
  const visible = contenido('Roles y permisos');

  it('es una pestaña propia, separada de «Personal y accesos»', () => {
    expect(HOSPITAL_ADMIN_PESTANAS).toContain('Roles y permisos');
    expect(admin('Roles y permisos')).toContain('data-hospital-admin="Roles y permisos"');
    // La pantalla operativa no reimplanta la lectura de cada rol.
    expect(contenido('Personal y accesos')).not.toContain(CONFIG.roles.etiquetaPuede);
  });

  it('lee cada rol como «Puede acceder a» y «No puede acceder a», no como estructura técnica', () => {
    expect(CONFIG.roles.etiquetaPuede).toBe('Puede acceder a');
    expect(CONFIG.roles.etiquetaNoPuede).toBe('No puede acceder a');
    expect(CONFIG.roles.items).toHaveLength(8);

    for (const rol of CONFIG.roles.items) {
      expect(visible).toContain(rol.titulo);
      for (const puede of rol.puede) {
        expect(visible).toContain(puede);
      }
      for (const noPuede of rol.noPuede) {
        expect(visible).toContain(noPuede);
      }
    }
    const html = admin('Roles y permisos');

    expect(apariciones(html, />Puede acceder a</gu)).toBe(CONFIG.roles.items.length);
    expect(apariciones(html, />No puede acceder a</gu)).toBe(CONFIG.roles.items.length);

    // No vuelve a la tabla técnica ROL / MÓDULO / ACCIÓN / ALCANCE.
    for (const tecnico of ['MÓDULO', 'ACCIÓN', 'ALCANCE', 'DESCRIPCIÓN']) {
      expect(visible).not.toContain(tecnico);
    }
  });

  it('advierte de forma inequívoca que no existe autorización real', () => {
    expect(visible).toContain('No implementan ni garantizan autorización');
    expect(visible).toContain('hoy no protegen ningún dato');
    expect(visible).toContain('asignar un rol no activa ni desactiva nada');
    expect(visible).toContain('sigue pendiente de aprobación');
  });

  it('enumera las operaciones que exigirán confirmación reforzada sin ejecutarlas', () => {
    const html = admin('Roles y permisos');

    expect(CONFIG.roles.sensibles.items).toHaveLength(6);
    for (const sensible of CONFIG.roles.sensibles.items) {
      expect(visible).toContain(sensible.etiqueta);
      expect(visible).toContain(sensible.detalle);
    }
    expect(apariciones(html, /data-hospital-confirmacion="reforzada"/gu)).toBe(
      CONFIG.roles.sensibles.items.length,
    );
    expect(html).not.toContain('data-hospital-accion="sin-implementar"');
    expect(visible).toContain('Todavía no están implementadas');
  });
});

/* ========================================================================== */
/* T-12 y T-13 — Configuración institucional                                  */
/* ========================================================================== */

describe('T-12 — Fidelidad de la configuración institucional', () => {
  it('reproduce los once parámetros de agenda con sus valores demostrativos', () => {
    const html = admin('Agenda y servicios');
    const visible = texto(main(html));

    expect(CONFIG.agenda.campos).toHaveLength(11);
    for (const campo of CONFIG.agenda.campos) {
      expect(visible).toContain(campo.etiqueta);
      expect(html).toContain(`value="${campo.valor}"`);
      expect(html).toContain(`for="hospital-admin-agenda-${campo.id}"`);
      expect(html).toContain(`id="hospital-admin-agenda-${campo.id}"`);
    }
  });

  it('reproduce los nueve datos de la institución y la ranura de logo', () => {
    const html = admin('Institución e integraciones');
    const visible = texto(main(html));

    expect(CONFIG.institucion.campos).toHaveLength(9);
    for (const campo of CONFIG.institucion.campos) {
      expect(visible).toContain(campo.etiqueta);
      expect(html).toContain(`for="hospital-admin-institucion-${campo.id}"`);
    }
    expect(visible).toContain('Logo de la institución');
    expect(visible).toContain('Cargar');
    expect(html).not.toContain('type="file"');
  });

  it('no incluye las reglas clínicas del semáforo del prototipo', () => {
    const visible = texto(main(admin('Agenda y servicios')));

    expect(visible).not.toContain('VERDE');
    expect(visible).not.toContain('AMARILLO');
    expect(visible).not.toContain('Glucosa en ayunas');
  });
});

describe('T-13 — Estado local de los parámetros', () => {
  it('los valores montados son siempre los del fixture y no se guardan', () => {
    const primero = admin('Agenda y servicios');
    const segundo = admin('Agenda y servicios');

    expect(primero).toBe(segundo);
    expect(texto(main(primero))).toContain('no se guarda, se pierde al recargar');
    expect(texto(main(primero))).toContain('no cambia la Agenda y citas ya aprobada');
  });

  it('la Agenda y citas aprobada conserva su contenido', () => {
    const agenda = texto(main(renderToStaticMarkup(<HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} vistaInicial="agenda" />)));

    expect(agenda).toContain('Agenda y citas');
  });
});

/* ========================================================================== */
/* T-14 y T-15 — Integraciones                                                */
/* ========================================================================== */

describe('T-14 — Catálogo de integraciones', () => {
  const visible = texto(main(admin('Institución e integraciones')));

  it('incluye las ocho ranuras exigidas más el proveedor de videollamada', () => {
    const nombres = CONFIG.integraciones.items.map((item) => item.nombre);

    expect(nombres).toEqual([
      'Google Calendar',
      'WhatsApp Business API',
      'Wompi · pasarela de pagos',
      'Proveedor de videollamada',
      'Historia clínica institucional',
      'Función Pública · FURAG',
      'ADRES',
      'SENA',
      `${branding.aiDisplayName} · OpenAI`,
    ]);

    for (const nombre of nombres) {
      expect(visible).toContain(nombre);
    }
  });

  it('usa exclusivamente los tres estados no activos autorizados', () => {
    const html = admin('Institución e integraciones');
    const estados = [
      ...html.matchAll(/data-hospital-integracion="(?<estado>[^"]+)"/gu),
    ].map((coincidencia) => coincidencia.groups?.estado ?? '');

    expect(estados).toHaveLength(CONFIG.integraciones.items.length);
    for (const estado of estados) {
      expect(HOSPITAL_ESTADOS_INTEGRACION).toContain(estado);
    }
    expect([...HOSPITAL_ESTADOS_INTEGRACION]).toEqual([
      'No configurada',
      'Pendiente',
      'Preparada para integración',
    ]);
  });

  it('ninguna aparenta conexión, sincronización, convenio ni actividad', () => {
    for (const prohibido of [
      'Conectada',
      'Conectado',
      'Activa',
      'Activo',
      'Sincronizada',
      'Sincronizado',
      'Disponible',
      'Parcial',
      'Sin conectar',
    ]) {
      expect(visible).not.toContain(prohibido);
    }
    expect(visible).toContain('Ninguna integración está conectada');
    expect(visible).toContain('no afirma convenio, aval institucional ni cumplimiento');
  });
});

describe('T-15 — Alcance negativo de las integraciones', () => {
  it('el marcado no incluye recursos remotos, iframes ni scripts', () => {
    const html = admin('Institución e integraciones').toLowerCase();

    for (const prohibido of ['http', '<iframe', '<script', 'client_id', 'api_key']) {
      expect(html).not.toContain(prohibido);
    }

    // Allowlist cerrada: el unico recurso local permitido es el corazon
    // canonico que la spec 015 exige en el sidebar. Ninguna otra fuente vale.
    const fuentes = [...html.matchAll(/src="(?<fuente>[^"]*)"/gu)].map(
      (coincidencia) => coincidencia.groups?.fuente ?? '',
    );

    for (const fuente of fuentes) {
      expect(fuente).toBe('/brand/corazon-check.png');
    }
    // Toda aparicion de `src=` debe estar cubierta por la allowlist: si
    // apareciera una fuente sin comillas o distinta, los conteos difieren.
    expect(fuentes).toHaveLength(html.split('src=').length - 1);
    expect(new Set(fuentes)).toEqual(new Set(['/brand/corazon-check.png']));
  });

  it('ningún dato de integración transporta credencial, endpoint ni enlace', () => {
    for (const integracion of CONFIG.integraciones.items) {
      const datos = `${integracion.nombre} ${integracion.detalle}`.toLowerCase();

      for (const prohibido of ['http', '://', '.com', 'www.', 'api_key', 'client_id', 'bearer']) {
        expect(datos).not.toContain(prohibido);
      }
    }
  });
});

/* ========================================================================== */
/* T-16 — Auditoría                                                           */
/* ========================================================================== */

describe('T-16 — Auditoría demostrativa', () => {
  const visible = texto(main(admin('Auditoría')));

  it('conserva los cinco eventos del prototipo con su composición', () => {
    expect(CONFIG.auditoria.items).toHaveLength(5);

    for (const evento of CONFIG.auditoria.items) {
      expect(visible).toContain(evento.usuario);
      expect(visible).toContain(evento.accion);
      expect(visible).toContain(evento.cuando);
      expect(visible).toContain(`Antes: ${evento.antes}`);
      expect(visible).toContain(`Después: ${evento.despues}`);
    }
  });

  it('los identifica como ejemplos y no como evidencia real', () => {
    expect(visible).toContain('ejemplos ficticios del prototipo');
    expect(visible).toContain('no una bitácora real ni evidencia de cumplimiento');
    expect(visible).toContain('no captura eventos, no persiste');
  });

  it('prepara módulo, objeto, resultado, origen y trazabilidad sin inventarlos', () => {
    expect(CONFIG.auditoria.estructuraFutura.campos).toHaveLength(11);

    for (const campo of CONFIG.auditoria.estructuraFutura.campos) {
      expect(visible).toContain(campo.etiqueta);
    }
    expect(visible).toContain('Módulo');
    expect(visible).toContain('Objeto afectado e identificador');
    expect(visible).toContain('Resultado exitoso o fallido');
    expect(visible).toContain('Origen de la operación');
    expect(visible).toContain('Referencia de trazabilidad');
  });

  it('no ofrece búsqueda, filtros ni exportación', () => {
    const html = admin('Auditoría');

    expect(visible).not.toContain('Exportar');
    expect(visible).not.toContain('Filtrar');
    expect(html).not.toContain('type="search"');
  });
});

/* ========================================================================== */
/* Terminología visible                                                       */
/* ========================================================================== */

describe('Terminología visible de la vista administrativa', () => {
  it('ninguna pestaña muestra el nombre técnico interno del proyecto', () => {
    for (const pestana of HOSPITAL_ADMIN_PESTANAS) {
      const html = admin(pestana);

      // `merdn-sr-only` es una clase técnica, no un texto para la persona.
      expect(texto(main(html))).not.toContain('MERDN');
      expect(html.replace(/merdn-sr-only/gu, '')).not.toContain('MERDN');
    }
  });

  it('el identificador de cada persona se llama «Código de personal»', () => {
    const visible = contenido('Personal y accesos');

    expect(visible).not.toContain('Código MERDN');
    expect(visible).toContain('Código de personal');
    expect(visible).toContain('El sistema genera automáticamente un código único de personal.');
    expect(CONFIG.personal.codigo.titulo).toBe('Código de personal');
  });
});

/* ========================================================================== */
/* T-18 — Accesibilidad                                                       */
/* ========================================================================== */

describe('T-18 — Accesibilidad de la vista administrativa', () => {
  it('cada control es un botón real y ningún estado depende solo del color', () => {
    for (const pestana of HOSPITAL_ADMIN_PESTANAS) {
      const html = admin(pestana);

      expect(html).not.toContain('<a ');
      expect(html).not.toContain('role="button"');
      expect(apariciones(html, /<button(?![^>]*type="button")/gu)).toBe(0);
    }
  });

  it('todo campo editable tiene etiqueta asociada', () => {
    for (const pestana of HOSPITAL_ADMIN_PESTANAS) {
      const html = admin(pestana);
      const controles = [
        ...html.matchAll(/<(?:input|select|textarea)[^>]*id="(?<id>[^"]+)"/gu),
      ].map((coincidencia) => coincidencia.groups?.id ?? '');

      for (const id of controles) {
        expect(html).toContain(`for="${id}"`);
      }
    }
  });

  it('cada acción no implementada anuncia su estado como texto', () => {
    for (const pestana of HOSPITAL_ADMIN_PESTANAS) {
      const html = admin(pestana);
      const acciones = apariciones(html, /data-hospital-accion="sin-implementar"/gu);
      const estados = HOSPITAL_ADMIN_ESTADOS_ACCION.reduce(
        (total, estado) => total + apariciones(html, new RegExp(`>${estado}<`, 'gu')),
        0,
      );

      expect(estados).toBeGreaterThanOrEqual(acciones);
    }
  });

  it('las tablas se anuncian con nombre y son desplazables con teclado', () => {
    for (const pestana of ['Membresías', 'Personal y accesos'] as const) {
      const html = admin(pestana);

      expect(html).toContain('role="region"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('scope="col"');
      expect(html).toContain('scope="row"');
    }
  });
});

/* ========================================================================== */
/* T-19 y alcance del módulo                                                  */
/* ========================================================================== */

describe('T-19 — Reflow sin desbordamiento global', () => {
  it('las tablas se desplazan dentro de su contenedor y usan patrones flexibles', () => {
    const css = readFileSync(
      fileURLToPath(new URL('./hospitalAdministration.module.css', import.meta.url)),
      'utf8',
    );

    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('repeat(auto-fit, minmax(220px, 1fr))');
    expect(css).toContain('flex-wrap: wrap');
    expect(css).not.toContain('overflow-x: hidden');
    expect(css).not.toContain('position: fixed');
  });
});

describe('Alcance del bloque administrativo', () => {
  const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));
  const ARCHIVOS = readdirSync(DIRECTORIO).filter(
    (archivo) => /Admin|administration/iu.test(archivo) && !archivo.includes('.test.'),
  );

  it('encuentra los archivos del bloque', () => {
    expect(ARCHIVOS.length).toBeGreaterThanOrEqual(4);
  });

  it('ninguno introduce red, persistencia, entorno ni dependencias nuevas', () => {
    for (const archivo of ARCHIVOS) {
      const codigo = readFileSync(`${DIRECTORIO}${archivo}`, 'utf8');

      expect(codigo).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
      expect(codigo).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/u);
      expect(codigo).not.toMatch(/process\.env|API_KEY|SECRET|PASSWORD/u);
      expect(codigo).not.toMatch(/Date\.now|new Date\b/u);
    }
  });
});
