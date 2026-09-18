/**
 * Modelo local de la bitácora completa del paciente (TASK-002A, FR-05).
 *
 * Fuente vinculante: vista `bitStep` de `prototype-claude/Eligeme-Paciente.dc.html`,
 * con la estructura confirmada por `Eligeme-Cuidador.dc.html`. El copy está
 * dirigido al paciente.
 *
 * La bitácora NO forma parte de la inscripción: se diligencia después, desde la
 * experiencia del paciente. Su progreso «Paso X de 8» es propio y no continúa
 * el «Paso X de 5» de la inscripción.
 *
 * Este módulo no calcula rangos, severidad, urgencia, alertas, diagnósticos ni
 * recomendaciones: solo conserva lo que la persona responde, en memoria.
 */

export const TOTAL_ETAPAS = 8;

export const TITULOS_ETAPA: readonly string[] = [
  '¿Cómo está hoy?',
  'Signos vitales',
  'Comida y líquidos',
  'Medicamentos',
  'Higiene y cuidado',
  'Movilidad',
  '¿Ocurrió algo importante?',
  'Observaciones y confirmar',
];

/** Respuesta de tres estados usada por higiene y movilidad. */
export type RespuestaTriple = 'Sí' | 'No' | 'No aplica';

export const RESPUESTAS_TRIPLES: readonly RespuestaTriple[] = ['Sí', 'No', 'No aplica'];

export const COMPARATIVOS: readonly { readonly id: string; readonly titulo: string; readonly nota: string }[] = [
  { id: 'mejor', titulo: 'Mejor', nota: 'Me siento mejor que ayer' },
  { id: 'igual', titulo: 'Igual', nota: 'Sin cambios frente a ayer' },
  { id: 'peor', titulo: 'Peor', nota: 'Me siento peor que ayer' },
];

export const ANIMOS: readonly string[] = [
  'Despierto y atento',
  'Más dormido de lo normal',
  'Confundido o desorientado',
  'No sé',
];

export const MOVILIDAD_GENERAL: readonly string[] = [
  'Camino',
  'Necesito ayuda',
  'Permanezco en cama',
];

export const ALIMENTACION: readonly string[] = [
  'Comí normalmente',
  'Comí poco',
  'No pude comer',
];

export const LIQUIDOS: readonly string[] = ['Sí', 'No', 'No sé'];

export const MEDICAMENTOS: readonly string[] = [
  'Los tomé',
  'Los tomé tarde',
  'No los tomé',
  'No sé',
];

export const MOTIVOS_MEDICAMENTO: readonly string[] = [
  'Se me olvidó',
  'No los tenía',
  'Me produjeron malestar',
  'No los pude tomar solo',
  'Otro motivo',
];

export const HIGIENE_ITEMS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'bano', label: 'Baño realizado' },
  { id: 'ropa', label: 'Cambio de ropa' },
  { id: 'piel', label: 'Cuidado de piel o cremas' },
  { id: 'panal', label: 'Cambio de pañal' },
  { id: 'oral', label: 'Higiene oral' },
];

export const MOVILIDAD_ITEMS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'levanto', label: '¿Se levantó o se movió?' },
  { id: 'postura', label: '¿Cambió de postura?' },
];

export const AYUDAS_MOVILIDAD: readonly string[] = [
  'Bastón',
  'Caminador',
  'Silla de ruedas',
  'Otra',
  'No utiliza ayuda',
];

export const EVENTO_NINGUNO = 'Nada de lo anterior';

export const EVENTOS: readonly string[] = [
  'Caída',
  'Fiebre',
  'Dolor',
  'Dificultad para respirar',
  'Cambio en la conducta',
  EVENTO_NINGUNO,
];

export interface BitacoraValores {
  readonly comparativo: string;
  readonly animo: string;
  readonly movilidadGeneral: string;

  readonly presionAlta: string;
  readonly presionBaja: string;
  readonly temperatura: string;
  readonly glucosa: string;

  readonly alimentacion: string;
  readonly liquidos: string;
  readonly notaComida: string;

  readonly medicamentos: string;
  readonly motivoMedicamento: string;
  readonly notaMedicamentos: string;

  readonly higiene: Readonly<Record<string, RespuestaTriple>>;
  readonly movilidad: Readonly<Record<string, RespuestaTriple>>;
  readonly ayuda: string;

  readonly eventos: readonly string[];
  readonly notaEvento: string;

  readonly observaciones: string;
  readonly autorizaDatos: boolean;
}

export const BITACORA_VACIA: BitacoraValores = {
  comparativo: '',
  animo: '',
  movilidadGeneral: '',
  presionAlta: '',
  presionBaja: '',
  temperatura: '',
  glucosa: '',
  alimentacion: '',
  liquidos: '',
  notaComida: '',
  medicamentos: '',
  motivoMedicamento: '',
  notaMedicamentos: '',
  higiene: {},
  movilidad: {},
  ayuda: '',
  eventos: [],
  notaEvento: '',
  observaciones: '',
  autorizaDatos: false,
};

/** Fase de la bitácora: portada, etapas 1 a 8 y cierre local. */
export type FaseBitacora = 'portada' | 'etapas' | 'confirmada';

export interface BitacoraState {
  readonly fase: FaseBitacora;
  readonly etapa: number;
  readonly valores: BitacoraValores;
  readonly errorAutorizacion: string | null;
}

export const BITACORA_INICIAL: BitacoraState = {
  fase: 'portada',
  etapa: 1,
  valores: BITACORA_VACIA,
  errorAutorizacion: null,
};

export type BitacoraAction =
  | { readonly type: 'empezar' }
  | { readonly type: 'siguiente' }
  | { readonly type: 'anterior' }
  | { readonly type: 'guardar' }
  | { readonly type: 'reiniciar' }
  | { readonly type: 'actualizar'; readonly patch: Partial<BitacoraValores> }
  | { readonly type: 'responderHigiene'; readonly item: string; readonly valor: RespuestaTriple }
  | { readonly type: 'responderMovilidad'; readonly item: string; readonly valor: RespuestaTriple }
  | { readonly type: 'alternarEvento'; readonly evento: string };

/**
 * «Nada de lo anterior» es excluyente frente al resto de eventos: no es una
 * regla clínica, solo evita una respuesta contradictoria.
 */
function alternarEvento(eventos: readonly string[], evento: string): readonly string[] {
  if (evento === EVENTO_NINGUNO) {
    return eventos.includes(EVENTO_NINGUNO) ? [] : [EVENTO_NINGUNO];
  }
  const sinNinguno = eventos.filter((item) => item !== EVENTO_NINGUNO);
  return sinNinguno.includes(evento)
    ? sinNinguno.filter((item) => item !== evento)
    : [...sinNinguno, evento];
}

export function bitacoraReducer(
  state: BitacoraState,
  action: BitacoraAction,
): BitacoraState {
  switch (action.type) {
    case 'empezar':
      return { ...BITACORA_INICIAL, fase: 'etapas' };

    case 'siguiente':
      return state.etapa >= TOTAL_ETAPAS
        ? state
        : { ...state, etapa: state.etapa + 1, errorAutorizacion: null };

    // Retroceder conserva todos los valores ya diligenciados.
    case 'anterior':
      return state.etapa <= 1
        ? { ...state, fase: 'portada', errorAutorizacion: null }
        : { ...state, etapa: state.etapa - 1, errorAutorizacion: null };

    case 'guardar':
      return state.valores.autorizaDatos
        ? { ...state, fase: 'confirmada', errorAutorizacion: null }
        : {
            ...state,
            errorAutorizacion:
              'Marque la autorización de tratamiento de datos para terminar la bitácora.',
          };

    case 'reiniciar':
      return BITACORA_INICIAL;

    case 'actualizar':
      return {
        ...state,
        valores: { ...state.valores, ...action.patch },
        errorAutorizacion: action.patch.autorizaDatos === true ? null : state.errorAutorizacion,
      };

    case 'responderHigiene':
      return {
        ...state,
        valores: {
          ...state.valores,
          higiene: { ...state.valores.higiene, [action.item]: action.valor },
        },
      };

    case 'responderMovilidad':
      return {
        ...state,
        valores: {
          ...state.valores,
          movilidad: { ...state.valores.movilidad, [action.item]: action.valor },
        },
      };

    case 'alternarEvento':
      return {
        ...state,
        valores: {
          ...state.valores,
          eventos: alternarEvento(state.valores.eventos, action.evento),
        },
      };

    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/* Resumen de la etapa 8                                                       */
/* -------------------------------------------------------------------------- */

export interface FilaResumen {
  readonly etiqueta: string;
  readonly valor: string;
}

const SIN_RESPONDER = 'Sin responder';

/** Repite lo respondido, sin interpretarlo ni evaluarlo. */
export function resumenBitacora(valores: BitacoraValores): readonly FilaResumen[] {
  const comparativo = COMPARATIVOS.find((item) => item.id === valores.comparativo);
  const presion =
    valores.presionAlta.trim().length > 0 && valores.presionBaja.trim().length > 0
      ? `${valores.presionAlta} / ${valores.presionBaja}`
      : 'Sin registrar';

  return [
    { etiqueta: '¿Cómo está hoy?', valor: comparativo?.titulo ?? SIN_RESPONDER },
    { etiqueta: 'Presión arterial', valor: presion },
    { etiqueta: 'Comida', valor: valores.alimentacion || SIN_RESPONDER },
    { etiqueta: 'Medicamentos', valor: valores.medicamentos || SIN_RESPONDER },
    {
      etiqueta: 'Eventos reportados',
      valor:
        valores.eventos.length === 0 ? SIN_RESPONDER : valores.eventos.join(' · '),
    },
  ];
}
