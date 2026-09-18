import type { Dispatch, ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import {
  Chip,
  ChipList,
  ConsentBody,
  ConsentOption,
  RadioOption,
  Segment,
  SegmentedGroup,
} from '@/components/ui/Choice';
import { EliSpeech } from '@/components/ui/Eli';
import { Field, FieldError, FieldGroup, Input, Label, Textarea } from '@/components/ui/Field';
import { DeviceStatusBar, Screen } from '@/components/ui/PhoneShell';

import {
  ALIMENTACION,
  ANIMOS,
  AYUDAS_MOVILIDAD,
  COMPARATIVOS,
  EVENTO_NINGUNO,
  EVENTOS,
  HIGIENE_ITEMS,
  LIQUIDOS,
  MEDICAMENTOS,
  MOTIVOS_MEDICAMENTO,
  MOVILIDAD_GENERAL,
  MOVILIDAD_ITEMS,
  RESPUESTAS_TRIPLES,
  TITULOS_ETAPA,
  TOTAL_ETAPAS,
  resumenBitacora,
} from './bitacoraFlow';
import type {
  BitacoraAction,
  BitacoraState,
  BitacoraValores,
  RespuestaTriple,
} from './bitacoraFlow';
import styles from './paciente.module.css';

/**
 * Bitácora completa del paciente (TASK-002A, FR-05).
 *
 * Ocho etapas posteriores a la inscripción, con progreso propio «Paso X de 8»,
 * anterior/siguiente, conservación de valores al retroceder y revisión final.
 *
 * No calcula rangos, severidad, urgencia, alertas, diagnósticos ni
 * recomendaciones, y no muestra historial ni pacientes demostrativos.
 */

const ID_AUTORIZACION = 'bitacora-autoriza-datos';
const ID_ERROR_AUTORIZACION = 'bitacora-error-autoriza-datos';

interface BitacoraProps {
  readonly state: BitacoraState;
  readonly dispatch: Dispatch<BitacoraAction>;
  readonly onVolverAlInicio: () => void;
}

function OpcionesUnicas({
  nombre,
  opciones,
  valor,
  onChange,
}: {
  readonly nombre: string;
  readonly opciones: readonly string[];
  readonly valor: string;
  readonly onChange: (valor: string) => void;
}): ReactNode {
  return (
    <div className={styles.diaryStack}>
      {opciones.map((opcion) => (
        <RadioOption
          key={opcion}
          name={nombre}
          value={opcion}
          checked={valor === opcion}
          onChange={() => onChange(opcion)}
          title={opcion}
          subtitle=""
        />
      ))}
    </div>
  );
}

function FilaTriple({
  nombre,
  etiqueta,
  valor,
  onChange,
}: {
  readonly nombre: string;
  readonly etiqueta: string;
  readonly valor: RespuestaTriple | undefined;
  readonly onChange: (valor: RespuestaTriple) => void;
}): ReactNode {
  return (
    <div className={styles.diaryTripleRow}>
      <FieldGroup legend={etiqueta}>
        <SegmentedGroup>
          {RESPUESTAS_TRIPLES.map((opcion) => (
            <Segment
              key={opcion}
              name={nombre}
              value={opcion}
              checked={valor === opcion}
              onChange={() => onChange(opcion)}
              label={opcion}
            />
          ))}
        </SegmentedGroup>
      </FieldGroup>
    </div>
  );
}

export function BitacoraPaciente({
  state,
  dispatch,
  onVolverAlInicio,
}: BitacoraProps): ReactNode {
  const { valores } = state;
  const actualizar = (patch: Partial<BitacoraValores>): void => {
    dispatch({ type: 'actualizar', patch });
  };

  if (state.fase === 'portada') {
    return (
      <Screen tone="lienzo">
        <DeviceStatusBar tone="claro" />
        <div className={styles.diaryScroll}>
          <div className={styles.diaryCard}>
            <h1 className={styles.diaryStepTitle}>Mi bitácora</h1>
            <p className={styles.diaryHint}>
              Ocho preguntas sencillas sobre cómo pasó el día. Puede volver atrás en
              cualquier momento y sus respuestas se conservan mientras no recargue la página.
            </p>
            <p className={styles.diaryNote}>
              La bitácora no forma parte de la inscripción y no es requisito para terminarla.
              Esta demostración no guarda, no envía y no interpreta ninguna respuesta.
            </p>
            <Button variant="primary" onClick={() => dispatch({ type: 'empezar' })}>
              Empezar la bitácora de hoy
            </Button>
            <Button variant="quietMuted" block onClick={onVolverAlInicio}>
              Volver a mi inicio
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  if (state.fase === 'confirmada') {
    return (
      <Screen tone="lienzo">
        <DeviceStatusBar tone="claro" />
        <div className={styles.diaryScroll}>
          <div className={styles.diaryCard}>
            <div className={styles.doneBlock}>
              <h1 className={styles.doneTitle}>Bitácora completada</h1>
              <p className={styles.doneBody}>
                Así terminaría el registro del día. En esta demostración local nada se guardó,
                nada se envió y ningún equipo de atención recibió la información.
              </p>
            </div>
            <ul className={styles.diarySummary}>
              {resumenBitacora(valores).map((fila) => (
                <li key={fila.etiqueta} className={styles.diarySummaryRow}>
                  <span className={styles.diarySummaryLabel}>{fila.etiqueta}</span>
                  <span className={styles.diarySummaryValue}>{fila.valor}</span>
                </li>
              ))}
            </ul>
            <Button variant="primary" onClick={onVolverAlInicio}>
              Volver a mi inicio
            </Button>
            <Button variant="quietMuted" block onClick={() => dispatch({ type: 'reiniciar' })}>
              Empezar otra bitácora
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  const etapa = state.etapa;
  const porcentaje = Math.round((etapa / TOTAL_ETAPAS) * 100);
  const titulo = TITULOS_ETAPA[etapa - 1] ?? '';

  return (
    <Screen tone="lienzo">
      <DeviceStatusBar tone="claro" />

      <div className={styles.diaryScroll}>
        <div className={styles.diaryHeader}>
          <div className={styles.diaryHeaderTop}>
            <h1 className={styles.diaryStepTitle}>{titulo}</h1>
            <p className={styles.diaryCounter}>{`Paso ${etapa} de ${TOTAL_ETAPAS}`}</p>
          </div>
          <div
            className={styles.diaryTrack}
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_ETAPAS}
            aria-valuenow={etapa}
            aria-valuetext={`Paso ${etapa} de ${TOTAL_ETAPAS} de la bitácora`}
          >
            <div className={styles.diaryFill} style={{ width: `${porcentaje}%` }} />
          </div>
        </div>

        {etapa === 1 ? (
          <div className={styles.diaryCard}>
            <EliSpeech intencion="guia">
              Empecemos por lo más importante: cómo te sientes hoy comparado con ayer.
            </EliSpeech>

            <FieldGroup legend="¿Cómo se siente comparado con ayer?">
              <div className={styles.diaryStack}>
                {COMPARATIVOS.map((opcion) => (
                  <RadioOption
                    key={opcion.id}
                    name="comparativo"
                    value={opcion.id}
                    checked={valores.comparativo === opcion.id}
                    onChange={() => actualizar({ comparativo: opcion.id })}
                    title={opcion.titulo}
                    subtitle={opcion.nota}
                  />
                ))}
              </div>
            </FieldGroup>

            <FieldGroup legend="¿Cómo se siente de ánimo y atención?">
              <OpcionesUnicas
                nombre="animo"
                opciones={ANIMOS}
                valor={valores.animo}
                onChange={(animo) => actualizar({ animo })}
              />
            </FieldGroup>

            <FieldGroup legend="¿Cómo se moviliza hoy?">
              <OpcionesUnicas
                nombre="movilidadGeneral"
                opciones={MOVILIDAD_GENERAL}
                valor={valores.movilidadGeneral}
                onChange={(movilidadGeneral) => actualizar({ movilidadGeneral })}
              />
            </FieldGroup>
          </div>
        ) : null}

        {etapa === 2 ? (
          <div className={styles.diaryCard}>
            <p className={styles.diaryQuestion}>Signos vitales</p>
            <p className={styles.diaryHint}>
              Registre solo los datos que tenga a la mano. No hace falta llenarlos todos.
            </p>

            <div className={styles.diaryRow}>
              <div className={styles.diaryRowItem}>
                <Field>
                  <Label htmlFor="bitacora-presion-alta">Presión alta</Label>
                  <Input
                    id="bitacora-presion-alta"
                    size="compact"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="128"
                    value={valores.presionAlta}
                    onChange={(event) => actualizar({ presionAlta: event.target.value })}
                  />
                </Field>
              </div>
              <div className={styles.diaryRowItem}>
                <Field>
                  <Label htmlFor="bitacora-presion-baja">Presión baja</Label>
                  <Input
                    id="bitacora-presion-baja"
                    size="compact"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="78"
                    value={valores.presionBaja}
                    onChange={(event) => actualizar({ presionBaja: event.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className={styles.diaryRow}>
              <div className={styles.diaryRowItem}>
                <Field>
                  <Label htmlFor="bitacora-temperatura">Temperatura</Label>
                  <Input
                    id="bitacora-temperatura"
                    size="compact"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="36.8"
                    value={valores.temperatura}
                    onChange={(event) => actualizar({ temperatura: event.target.value })}
                  />
                </Field>
              </div>
              <div className={styles.diaryRowItem}>
                <Field>
                  <Label htmlFor="bitacora-glucosa">Glucosa</Label>
                  <Input
                    id="bitacora-glucosa"
                    size="compact"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="110"
                    value={valores.glucosa}
                    onChange={(event) => actualizar({ glucosa: event.target.value })}
                  />
                </Field>
              </div>
            </div>

            <p className={styles.diaryNote}>
              Esta demostración solo conserva lo que usted escribe: no evalúa rangos, no
              genera alertas y no emite ninguna conclusión de salud.
            </p>
          </div>
        ) : null}

        {etapa === 3 ? (
          <div className={styles.diaryCard}>
            <FieldGroup legend="¿Comió normalmente?">
              <OpcionesUnicas
                nombre="alimentacion"
                opciones={ALIMENTACION}
                valor={valores.alimentacion}
                onChange={(alimentacion) => actualizar({ alimentacion })}
              />
            </FieldGroup>

            <FieldGroup legend="¿Tomó suficientes líquidos?">
              <SegmentedGroup>
                {LIQUIDOS.map((opcion) => (
                  <Segment
                    key={opcion}
                    name="liquidos"
                    value={opcion}
                    checked={valores.liquidos === opcion}
                    onChange={() => actualizar({ liquidos: opcion })}
                    label={opcion}
                  />
                ))}
              </SegmentedGroup>
            </FieldGroup>

            <Field>
              <Label htmlFor="bitacora-nota-comida">
                ¿Hubo algún problema con la comida o los líquidos?
              </Label>
              <Textarea
                id="bitacora-nota-comida"
                rows={3}
                placeholder="Opcional"
                value={valores.notaComida}
                onChange={(event) => actualizar({ notaComida: event.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {etapa === 4 ? (
          <div className={styles.diaryCard}>
            <FieldGroup legend="¿Tomó sus medicamentos?">
              <OpcionesUnicas
                nombre="medicamentos"
                opciones={MEDICAMENTOS}
                valor={valores.medicamentos}
                onChange={(medicamentos) => actualizar({ medicamentos })}
              />
            </FieldGroup>

            {valores.medicamentos === 'No los tomé' ||
            valores.medicamentos === 'Los tomé tarde' ? (
              <FieldGroup legend="¿Por qué?">
                <ChipList>
                  {MOTIVOS_MEDICAMENTO.map((motivo) => (
                    <Chip
                      key={motivo}
                      name="motivoMedicamento"
                      value={motivo}
                      checked={valores.motivoMedicamento === motivo}
                      onChange={() =>
                        actualizar({
                          motivoMedicamento:
                            valores.motivoMedicamento === motivo ? '' : motivo,
                        })
                      }
                      label={motivo}
                    />
                  ))}
                </ChipList>
              </FieldGroup>
            ) : null}

            <Field>
              <Label htmlFor="bitacora-nota-medicamentos">
                ¿Quiere añadir algo sobre sus medicamentos?
              </Label>
              <Textarea
                id="bitacora-nota-medicamentos"
                rows={3}
                placeholder="Opcional"
                value={valores.notaMedicamentos}
                onChange={(event) => actualizar({ notaMedicamentos: event.target.value })}
              />
            </Field>

            <p className={styles.diaryNote}>
              La bitácora no indica, cambia ni suspende ningún tratamiento.
            </p>
          </div>
        ) : null}

        {etapa === 5 ? (
          <div className={styles.diaryCard}>
            <p className={styles.diaryQuestion}>Su higiene y cuidado de hoy</p>
            <p className={styles.diaryHint}>
              Responda solo lo que corresponda a su situación.
            </p>
            <div className={styles.diaryStack}>
              {HIGIENE_ITEMS.map((item) => (
                <FilaTriple
                  key={item.id}
                  nombre={`higiene-${item.id}`}
                  etiqueta={item.label}
                  valor={valores.higiene[item.id]}
                  onChange={(valor) =>
                    dispatch({ type: 'responderHigiene', item: item.id, valor })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}

        {etapa === 6 ? (
          <div className={styles.diaryCard}>
            <p className={styles.diaryQuestion}>Su movilización de hoy</p>
            <div className={styles.diaryStack}>
              {MOVILIDAD_ITEMS.map((item) => (
                <FilaTriple
                  key={item.id}
                  nombre={`movilidad-${item.id}`}
                  etiqueta={item.label}
                  valor={valores.movilidad[item.id]}
                  onChange={(valor) =>
                    dispatch({ type: 'responderMovilidad', item: item.id, valor })
                  }
                />
              ))}
            </div>

            <FieldGroup legend="¿Usó alguna ayuda para movilizarse?">
              <ChipList>
                {AYUDAS_MOVILIDAD.map((ayuda) => (
                  <Chip
                    key={ayuda}
                    name="ayuda"
                    value={ayuda}
                    checked={valores.ayuda === ayuda}
                    onChange={() => actualizar({ ayuda: valores.ayuda === ayuda ? '' : ayuda })}
                    label={ayuda}
                  />
                ))}
              </ChipList>
            </FieldGroup>
          </div>
        ) : null}

        {etapa === 7 ? (
          <div className={styles.diaryCard}>
            <p className={styles.diaryQuestion}>¿Le ocurrió algo importante hoy?</p>
            <p className={styles.diaryHint}>Puede marcar varios.</p>

            <FieldGroup legend="Eventos del día" hiddenLegend>
              <ChipList>
                {EVENTOS.map((evento) => (
                  <Chip
                    key={evento}
                    name="eventos"
                    value={evento}
                    checked={valores.eventos.includes(evento)}
                    onChange={() => dispatch({ type: 'alternarEvento', evento })}
                    label={evento}
                  />
                ))}
              </ChipList>
            </FieldGroup>

            {valores.eventos.some((evento) => evento !== EVENTO_NINGUNO) ? (
              <Field>
                <Label htmlFor="bitacora-nota-evento">¿Quiere contarnos qué pasó?</Label>
                <Textarea
                  id="bitacora-nota-evento"
                  rows={3}
                  placeholder="Opcional"
                  value={valores.notaEvento}
                  onChange={(event) => actualizar({ notaEvento: event.target.value })}
                />
              </Field>
            ) : null}

            <p className={styles.diaryNote}>
              Esta demostración no clasifica el riesgo del evento ni avisa a nadie.
            </p>
          </div>
        ) : null}

        {etapa === 8 ? (
          <div className={styles.diaryCard}>
            <Field>
              <Label htmlFor="bitacora-observaciones">¿Quiere contarnos algo más?</Label>
              <Textarea
                id="bitacora-observaciones"
                rows={4}
                placeholder="Opcional. No hace falta escribir nada."
                value={valores.observaciones}
                onChange={(event) => actualizar({ observaciones: event.target.value })}
              />
            </Field>

            <p className={styles.diaryQuestion}>Revise su registro</p>
            <ul className={styles.diarySummary}>
              {resumenBitacora(valores).map((fila) => (
                <li key={fila.etiqueta} className={styles.diarySummaryRow}>
                  <span className={styles.diarySummaryLabel}>{fila.etiqueta}</span>
                  <span className={styles.diarySummaryValue}>{fila.valor}</span>
                </li>
              ))}
            </ul>

            <ConsentOption
              id={ID_AUTORIZACION}
              name="autorizaDatos"
              value="autorizaDatos"
              checked={valores.autorizaDatos}
              describedBy={
                state.errorAutorizacion === null ? undefined : ID_ERROR_AUTORIZACION
              }
              onChange={(event) => actualizar({ autorizaDatos: event.target.checked })}
              title="Tratamiento de los datos registrados hoy"
            >
              <ConsentBody>
                Autorizo el tratamiento de mis datos de salud registrados hoy conforme a la
                Ley 1581 de 2012.
              </ConsentBody>
            </ConsentOption>
            {state.errorAutorizacion === null ? null : (
              <FieldError id={ID_ERROR_AUTORIZACION}>{state.errorAutorizacion}</FieldError>
            )}

            <Button variant="primary" onClick={() => dispatch({ type: 'guardar' })}>
              Terminar la bitácora
            </Button>
          </div>
        ) : null}

        <div className={styles.diaryActions}>
          <div className={styles.diaryActionsItem}>
            <Button variant="outline" onClick={() => dispatch({ type: 'anterior' })}>
              Anterior
            </Button>
          </div>
          {etapa < TOTAL_ETAPAS ? (
            <div className={styles.diaryActionsItem}>
              <Button variant="primary" onClick={() => dispatch({ type: 'siguiente' })}>
                Siguiente
              </Button>
            </div>
          ) : null}
        </div>

        <Button variant="quietMuted" block onClick={onVolverAlInicio}>
          Salir sin terminar
        </Button>
      </div>
    </Screen>
  );
}
