import type { Dispatch } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { CheckOption, Chip, ChipList, ConsentBody, ConsentOption, Segment, SegmentedGroup } from '@/components/ui/Choice';
import { EliSpeech } from '@/components/ui/Eli';
import { FieldError, FieldGroup } from '@/components/ui/Field';
import { nombreDepartamento, nombreMunicipio } from '@/data/divipola';

import {
  DIAGNOSTICO_OTROS,
  DIAGNOSTICOS,
  ZONAS,
  alternarEnLista,
  campoOtroDiagnostico,
  edadEnAnios,
  nombreCompleto,
  textoClasificacion,
  textoDiagnosticos,
  textoEdad,
  textoZona,
} from '../inscripcionFlow';
import type {
  DatosPaciente,
  Errores,
  InscripcionAction,
} from '../inscripcionFlow';
import { PACIENTES_DEMO } from '../patientDemoFixtures';
import styles from '../inscripcion.module.css';
import {
  AccionDemostrativa,
  CampoContrasena,
  CampoLista,
  CampoTexto,
  CampoTextoLargo,
  ErrorGrupo,
  Fila,
  FilaItem,
  GrupoUbicacion,
  PanelObligatorio,
  RequiredLegend,
  Seccion,
  Separador,
  SubPanel,
  idCampo,
  idError,
} from './piezas';

/**
 * Cinco pasos de la rama Paciente (TASK-002A).
 *
 * Referencia: `prototype-claude/Eligeme-Inscripcion.dc.html`, vistas `p1`–`p5`.
 * El rol ya está resuelto: ninguna pantalla vuelve a preguntarlo.
 *
 * Todos los datos solicitados son obligatorios (FR-04) y los campos
 * condicionales lo son mientras estén visibles. La ubicación usa el catálogo
 * local DANE DIVIPOLA (FR-04A).
 */

export interface PasoProps<T> {
  readonly paso: number;
  readonly valores: T;
  readonly errores: Errores;
  readonly dispatch: Dispatch<InscripcionAction>;
  /** Id del texto que explica que un control es solo demostrativo. */
  readonly avisoId: string;
  /** Fecha usada para calcular la edad; se inyecta para poder probarla. */
  readonly hoy: Date;
}

const TIPOS_DOCUMENTO = [
  'Cédula de ciudadanía',
  'Cédula de extranjería',
  'Pasaporte',
  'Permiso por Protección Temporal',
  'Otro',
];

const SEXOS = ['Femenino', 'Masculino', 'Otro', 'Prefiero no decirlo'];
const EPS = [
  'Nueva EPS',
  'Sanitas',
  'Sura',
  'Salud Total',
  'Compensar',
  'Famisanar',
  'Otra EPS',
  'No sabe',
  'No tiene EPS',
];
const TIPOS_DISCAPACIDAD = [
  'Física',
  'Visual',
  'Auditiva',
  'Intelectual',
  'Psicosocial',
  'Múltiple',
  'Otra',
];
const APOYOS = [
  'Ayuda para movilizarse',
  'Administración de medicamentos',
  'Alimentación',
  'Higiene personal',
  'Acompañamiento',
  'Supervisión permanente',
  'Otro',
];
const RELACIONES_VECINO = [
  'Vecino',
  'Familiar cercano',
  'Administrador',
  'Portero',
  'Líder comunitario',
  'Otro',
];


export function PasosPaciente({
  paso,
  valores,
  errores,
  dispatch,
  avisoId,
  hoy,
}: PasoProps<DatosPaciente>): ReactNode {
  const actualizar = (patch: Partial<DatosPaciente>): void => {
    dispatch({ type: 'actualizarPaciente', patch });
  };

  if (paso === 1) {
    return (
      <div className={styles.card}>
        <EliSpeech intencion="explica">
          Empecemos por tus datos. Te acompaño campo por campo si algo no se entiende.
        </EliSpeech>

        <section className={styles.demoProfiles} aria-labelledby="pacientes-demo-title">
          <p id="pacientes-demo-title" className={styles.eyebrow}>PACIENTES DEMO</p>
          <p className={styles.demoProfilesText}>
            Cargue un perfil completamente ficticio para recorrer los cinco pasos sin escribir los datos manualmente.
          </p>
          <div className={styles.demoProfilesActions}>
            {PACIENTES_DEMO.map((paciente) => (
              <Button
                key={paciente.id}
                variant="outline"
                onClick={() => dispatch({ type: 'cargarPacienteDemo', id: paciente.id })}
              >
                {paciente.etiqueta}
              </Button>
            ))}
          </div>
        </section>

        <RequiredLegend />

        <Seccion eyebrow="A · INFORMACIÓN PERSONAL">
          <CampoLista
            campo="tipoDocumento"
            label="Tipo de documento"
            value={valores.tipoDocumento}
            options={TIPOS_DOCUMENTO}
            onChange={(tipoDocumento) => actualizar({ tipoDocumento })}
          />
          <CampoTexto
            campo="documento"
            label="Número de documento"
            placeholder="Ej. 1032455789"
            inputMode="numeric"
            value={valores.documento}
            error={errores['documento']}
            onChange={(documento) => actualizar({ documento })}
          />
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="nombres"
                label="Nombres"
                placeholder="Ej. María"
                value={valores.nombres}
                error={errores['nombres']}
                onChange={(nombres) => actualizar({ nombres })}
              />
            </FilaItem>
            <FilaItem>
              <CampoTexto
                campo="apellidos"
                label="Apellidos"
                placeholder="Ej. Rodríguez"
                value={valores.apellidos}
                error={errores['apellidos']}
                onChange={(apellidos) => actualizar({ apellidos })}
              />
            </FilaItem>
          </Fila>
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="fechaNacimiento"
                label="Fecha de nacimiento"
                tipo="date"
                value={valores.fechaNacimiento}
                error={errores['fechaNacimiento']}
                onChange={(valor) =>
                  dispatch({
                    type: 'fechaNacimiento',
                    valor,
                    edad: edadEnAnios(valor, hoy),
                  })
                }
              />
            </FilaItem>
            <p className={styles.ageBadge}>{textoEdad(valores.edad)}</p>
          </Fila>
          <CampoLista
            campo="sexo"
            label="Sexo"
            value={valores.sexo}
            options={SEXOS}
            onChange={(sexo) => actualizar({ sexo })}
          />
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="telefono"
                label="Teléfono celular"
                placeholder="Ej. 300 456 7890"
                inputMode="tel"
                value={valores.telefono}
                error={errores['telefono']}
                onChange={(telefono) => actualizar({ telefono })}
              />
            </FilaItem>
            <FilaItem>
              <CampoTexto
                campo="telefonoAlterno"
                label="Teléfono alternativo"
                placeholder="Ej. 601 234 5678"
                inputMode="tel"
                value={valores.telefonoAlterno}
                error={errores['telefonoAlterno']}
                onChange={(telefonoAlterno) => actualizar({ telefonoAlterno })}
              />
            </FilaItem>
          </Fila>
          <CampoTexto
            campo="correo"
            label="Correo electrónico"
            placeholder="Ej. maria.rodriguez@correo.com"
            tipo="email"
            inputMode="email"
            value={valores.correo}
            error={errores['correo']}
            onChange={(correo) => actualizar({ correo })}
          />
          <CampoContrasena
            campo="password"
            label="Contraseña para acceso persistente"
            placeholder="Mínimo 8 caracteres, una letra y un número"
            value={valores.password ?? ''}
            error={errores['password']}
            onChange={(password) => actualizar({ password })}
          />
        </Seccion>
      </div>
    );
  }

  if (paso === 2) {
    const otrosActivo = valores.diagnosticos.includes(DIAGNOSTICO_OTROS);

    return (
      <div className={styles.card}>
        <RequiredLegend />

        <div className={styles.blockTight}>
          <p className={styles.eyebrow}>B · CLASIFICACIÓN PRIORITARIA</p>
          <p className={styles.lead}>Puede marcar una, dos o las tres. No son excluyentes.</p>
        </div>

        <FieldGroup
          legend="Clasificación prioritaria"
          hiddenLegend
          describedBy={
            errores['clasificacion'] === undefined ? undefined : idError('clasificacion')
          }
        >
          <div className={styles.classificationList}>
            <CheckOption
              name="clasificacion"
              value="mayor60"
              checked={valores.mayor60}
              onChange={() => dispatch({ type: 'alternarClasificacion', clave: 'mayor60' })}
              title="Persona mayor de 60 años"
              subtitle={
                valores.mayor60Automatico
                  ? 'Marcado automáticamente por su fecha de nacimiento'
                  : '60 años o más'
              }
            />

            <CheckOption
              name="clasificacion"
              value="discapacidad"
              checked={valores.discapacidad}
              onChange={() =>
                dispatch({ type: 'alternarClasificacion', clave: 'discapacidad' })
              }
              title="Persona con discapacidad"
              subtitle="Física, visual, auditiva, intelectual, psicosocial o múltiple"
            />

            {valores.discapacidad ? (
              <SubPanel>
                <CampoLista
                  campo="tipoDiscapacidad"
                  label="Tipo de discapacidad"
                  value={valores.tipoDiscapacidad}
                  options={TIPOS_DISCAPACIDAD}
                  onChange={(tipoDiscapacidad) => actualizar({ tipoDiscapacidad })}
                />
                <FieldGroup
                  legend="¿Está inscrito en el Registro para la Localización y Caracterización de Personas con Discapacidad (RLCPD)? *"
                  describedBy={
                    errores['registroRlcpd'] === undefined
                      ? undefined
                      : idError('registroRlcpd')
                  }
                >
                  <SegmentedGroup>
                    {['Sí', 'No', 'No sabe'].map((opcion) => (
                      <Segment
                        key={opcion}
                        name="registroRlcpd"
                        value={opcion}
                        checked={valores.registroRlcpd === opcion}
                        onChange={() => actualizar({ registroRlcpd: opcion })}
                        label={opcion}
                      />
                    ))}
                  </SegmentedGroup>
                </FieldGroup>
                <ErrorGrupo campo="registroRlcpd" mensaje={errores['registroRlcpd']} />
                <p className={styles.blockBody}>
                  No necesita diagnóstico médico para inscribirse.
                </p>
              </SubPanel>
            ) : null}

            <CheckOption
              name="clasificacion"
              value="requiereCuidadoCasa"
              checked={valores.requiereCuidadoCasa}
              onChange={() =>
                dispatch({ type: 'alternarClasificacion', clave: 'requiereCuidadoCasa' })
              }
              title="Persona que requiere cuidados en casa"
              subtitle="Necesito apoyo para las actividades del día"
            />

            {valores.requiereCuidadoCasa ? (
              <SubPanel>
                <FieldGroup
                  legend="¿Actualmente tiene cuidador? *"
                  describedBy={
                    errores['tieneCuidador'] === undefined
                      ? undefined
                      : idError('tieneCuidador')
                  }
                >
                  <SegmentedGroup>
                    {['Sí', 'No'].map((opcion) => (
                      <Segment
                        key={opcion}
                        name="tieneCuidador"
                        value={opcion}
                        checked={valores.tieneCuidador === opcion}
                        onChange={() => actualizar({ tieneCuidador: opcion })}
                        label={opcion}
                      />
                    ))}
                  </SegmentedGroup>
                </FieldGroup>
                <ErrorGrupo campo="tieneCuidador" mensaje={errores['tieneCuidador']} />
                <FieldGroup
                  legend="Tipo de apoyo que necesita · puede marcar varios *"
                  describedBy={
                    errores['apoyos'] === undefined ? undefined : idError('apoyos')
                  }
                >
                  <ChipList>
                    {APOYOS.map((apoyo) => (
                      <Chip
                        key={apoyo}
                        name="apoyos"
                        value={apoyo}
                        checked={valores.apoyos.includes(apoyo)}
                        onChange={() =>
                          actualizar({ apoyos: alternarEnLista(valores.apoyos, apoyo) })
                        }
                        label={apoyo}
                      />
                    ))}
                  </ChipList>
                </FieldGroup>
                <ErrorGrupo campo="apoyos" mensaje={errores['apoyos']} />
              </SubPanel>
            ) : null}
          </div>
        </FieldGroup>

        <ErrorGrupo campo="clasificacion" mensaje={errores['clasificacion']} />

        <Separador />

        <div className={styles.block}>
          <p className={styles.eyebrow}>C · DIAGNÓSTICOS</p>
          <p className={styles.lead}>
            ¿Tiene alguna de estas condiciones? Toque las que apliquen. Es independiente de
            la clasificación anterior.
          </p>

          <FieldGroup
            legend="Diagnósticos"
            hiddenLegend
            describedBy={
              errores['diagnosticos'] === undefined ? undefined : idError('diagnosticos')
            }
          >
            <ChipList>
              {DIAGNOSTICOS.map((diagnostico) => (
                <Chip
                  key={diagnostico}
                  name="diagnosticos"
                  value={diagnostico}
                  checked={valores.diagnosticos.includes(diagnostico)}
                  onChange={() =>
                    dispatch({ type: 'alternarDiagnostico', valor: diagnostico })
                  }
                  label={diagnostico}
                />
              ))}
            </ChipList>
          </FieldGroup>

          <ErrorGrupo campo="diagnosticos" mensaje={errores['diagnosticos']} />

          {otrosActivo ? (
            <SubPanel>
              <ul className={styles.otherList}>
                {valores.otrosDiagnosticos.map((texto, indice) => (
                  // El índice identifica la fila: las filas no se reordenan.
                  <li key={`otro-${indice}`} className={styles.otherRow}>
                    <div className={styles.otherField}>
                      <CampoTexto
                        campo={campoOtroDiagnostico(indice)}
                        label={`Otro diagnóstico ${indice + 1}`}
                        placeholder="Escriba el diagnóstico"
                        value={texto}
                        error={errores[campoOtroDiagnostico(indice)]}
                        onChange={(valor) =>
                          dispatch({ type: 'escribirOtroDiagnostico', indice, texto: valor })
                        }
                      />
                    </div>
                    <Button
                      variant="pill"
                      onClick={() => dispatch({ type: 'quitarOtroDiagnostico', indice })}
                    >
                      <span aria-hidden="true">×</span>
                      <span className="merdn-sr-only">
                        {`Quitar el otro diagnóstico ${indice + 1}`}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                onClick={() => dispatch({ type: 'agregarOtroDiagnostico' })}
              >
                Añadir otro diagnóstico
              </Button>
            </SubPanel>
          ) : null}

          <p className={styles.note}>
            El detalle clínico se registra después, en la bitácora y la historia clínica.
          </p>
        </div>
      </div>
    );
  }

  if (paso === 3) {
    return (
      <div className={styles.card}>
        <RequiredLegend />

        <Seccion eyebrow="C · UBICACIÓN DEL PACIENTE">
          <GrupoUbicacion
            grupo="principal"
            prefijo="paciente"
            ubicacion={valores.ubicacion}
            errores={errores}
            dispatch={dispatch}
          />
          {/*
            Zona urbana o rural (TASK-MVP-CORE-01, corrección final).
            Se declara explícitamente: no se deduce de la dirección ni del
            corregimiento. Reutiliza el mismo control de lista que el resto de
            la ubicación, de modo que no altera el diseño aprobado.
          */}
          <CampoLista
            campo="zona"
            label="Zona"
            placeholder="Elija una opción"
            value={valores.zona}
            options={ZONAS.map((zona) => ({ value: zona.id, label: zona.etiqueta }))}
            error={errores['zona']}
            onChange={(zona) => actualizar({ zona: zona as DatosPaciente['zona'] })}
          />
          <CampoTexto
            campo="barrio"
            label="Barrio o vereda"
            placeholder="Ej. La Esperanza"
            value={valores.barrio}
            error={errores['barrio']}
            onChange={(barrio) => actualizar({ barrio })}
          />
          <CampoTexto
            campo="direccion"
            label="Dirección completa"
            placeholder="Ej. Cra 45 # 32-16"
            value={valores.direccion}
            error={errores['direccion']}
            onChange={(direccion) => actualizar({ direccion })}
          />
          <CampoTextoLargo
            campo="indicaciones"
            label="Complemento o indicaciones para llegar"
            placeholder="Ej. Casa azul detrás de la iglesia. La calle no tiene placa."
            hint="Descríbalo como se lo diría a un vecino. Esto es lo que más ayuda al equipo a encontrarlo."
            value={valores.indicaciones}
            error={errores['indicaciones']}
            onChange={(indicaciones) => actualizar({ indicaciones })}
          />
          <AccionDemostrativa avisoId={avisoId}>Usar mi ubicación</AccionDemostrativa>
        </Seccion>

        <Separador />

        <Seccion eyebrow="D · EPS">
          <CampoLista
            campo="eps"
            label="EPS a la que pertenece"
            value={valores.eps}
            options={EPS}
            error={errores['eps']}
            onChange={(eps) => actualizar({ eps })}
          />
        </Seccion>
      </div>
    );
  }

  if (paso === 4) {
    return (
      <div className={styles.card}>
        <RequiredLegend />

        <Seccion eyebrow="E · CONTACTO FAMILIAR O DE EMERGENCIA">
          <CampoTexto
            campo="contactoNombre"
            label="Nombre completo"
            placeholder="Ej. Carlos Rodríguez"
            value={valores.contactoNombre}
            error={errores['contactoNombre']}
            onChange={(contactoNombre) => actualizar({ contactoNombre })}
          />
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="contactoParentesco"
                label="Parentesco"
                placeholder="Ej. Hijo"
                value={valores.contactoParentesco}
                error={errores['contactoParentesco']}
                onChange={(contactoParentesco) => actualizar({ contactoParentesco })}
              />
            </FilaItem>
            <FilaItem>
              <CampoTexto
                campo="contactoTelefono"
                label="Teléfono"
                placeholder="Ej. 311 220 3355"
                inputMode="tel"
                value={valores.contactoTelefono}
                error={errores['contactoTelefono']}
                onChange={(contactoTelefono) => actualizar({ contactoTelefono })}
              />
            </FilaItem>
          </Fila>
        </Seccion>

        <PanelObligatorio
          eyebrow="F · OBLIGATORIO"
          titulo="Persona cercana que puede ayudarnos a ubicarlo"
          descripcion="Registre un vecino o persona cercana que pueda ayudarnos a localizarlo si no logramos comunicarnos con usted."
        >
          <CampoTexto
            campo="vecinoNombre"
            label="Nombre del vecino o contacto cercano"
            placeholder="Ej. Rosa Delgado"
            value={valores.vecinoNombre}
            error={errores['vecinoNombre']}
            onChange={(vecinoNombre) => actualizar({ vecinoNombre })}
          />
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="vecinoTelefono"
                label="Teléfono"
                placeholder="Ej. 312 778 4410"
                inputMode="tel"
                value={valores.vecinoTelefono}
                error={errores['vecinoTelefono']}
                onChange={(vecinoTelefono) => actualizar({ vecinoTelefono })}
              />
            </FilaItem>
            <FilaItem>
              <CampoLista
                campo="vecinoRelacion"
                label="Relación con el paciente"
                value={valores.vecinoRelacion}
                options={RELACIONES_VECINO}
                onChange={(vecinoRelacion) => actualizar({ vecinoRelacion })}
              />
            </FilaItem>
          </Fila>
          <CampoTexto
            campo="vecinoDireccion"
            label="Dirección o referencia"
            placeholder="Ej. Casa de al lado, puerta verde"
            value={valores.vecinoDireccion}
            error={errores['vecinoDireccion']}
            onChange={(vecinoDireccion) => actualizar({ vecinoDireccion })}
          />
          <ConsentOption
            id={idCampo('autorizaVecino')}
            name="autorizaVecino"
            value="autorizaVecino"
            checked={valores.autorizaVecino}
            describedBy={
              errores['autorizaVecino'] === undefined ? undefined : idError('autorizaVecino')
            }
            onChange={(event) => actualizar({ autorizaVecino: event.target.checked })}
            title="Autorización del contacto cercano"
          >
            <ConsentBody>
              Confirmo que esta persona puede ser contactada únicamente cuando sea necesario
              localizarme o apoyarme en una situación relacionada con mi atención.
            </ConsentBody>
          </ConsentOption>
          {errores['autorizaVecino'] === undefined ? null : (
            <FieldError id={idError('autorizaVecino')}>{errores['autorizaVecino']}</FieldError>
          )}
        </PanelObligatorio>
      </div>
    );
  }

  const municipio = nombreMunicipio(valores.ubicacion.municipio);
  const departamento = nombreDepartamento(valores.ubicacion.departamento);
  const territorio =
    municipio.length === 0 ? 'Sin municipio' : `${municipio} (${departamento})`;

  return (
    <div className={styles.card}>
      <Seccion eyebrow="REVISE SU INFORMACIÓN">
        <ul className={styles.review}>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>NOMBRE</p>
              <p className={styles.reviewValue}>{nombreCompleto(valores)}</p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 1 })}>
              Editar
              <span className="merdn-sr-only"> los datos personales</span>
            </Button>
          </li>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>DOCUMENTO Y TELÉFONO</p>
              <p className={styles.reviewValue}>
                {`${valores.documento || 'Sin documento'} · ${valores.telefono || 'Sin teléfono'}`}
              </p>
              <p className={styles.reviewLabel}>{textoEdad(valores.edad)}</p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 1 })}>
              Editar
              <span className="merdn-sr-only"> el documento y el teléfono</span>
            </Button>
          </li>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>CLASIFICACIÓN</p>
              <p className={styles.reviewValue}>{textoClasificacion(valores)}</p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 2 })}>
              Editar
              <span className="merdn-sr-only"> la clasificación</span>
            </Button>
          </li>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>DIAGNÓSTICOS</p>
              <p className={styles.reviewValue}>{textoDiagnosticos(valores)}</p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 2 })}>
              Editar
              <span className="merdn-sr-only"> los diagnósticos</span>
            </Button>
          </li>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>UBICACIÓN Y EPS</p>
              <p className={styles.reviewValue}>
                {`${valores.direccion || 'Sin dirección'} · ${territorio} · ${valores.eps}`}
              </p>
              <p className={styles.reviewLabel}>
                {`Zona: ${textoZona(valores.zona)} · Corregimiento: ${valores.ubicacion.corregimiento || 'Sin corregimiento'}`}
              </p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 3 })}>
              Editar
              <span className="merdn-sr-only"> la ubicación y la EPS</span>
            </Button>
          </li>
        </ul>
      </Seccion>

      <Separador />

      <Seccion eyebrow="G · AUTORIZACIÓN">
        <ConsentOption
          id={idCampo('autorizaDatos')}
          name="autorizaDatos"
          value="autorizaDatos"
          checked={valores.autorizaDatos}
          describedBy={
            errores['autorizaDatos'] === undefined ? undefined : idError('autorizaDatos')
          }
          onChange={(event) => actualizar({ autorizaDatos: event.target.checked })}
          title="Tratamiento de datos personales y de salud"
        >
          <ConsentBody>
            Autorizo el tratamiento de mis datos personales y de salud conforme a la Ley 1581
            de 2012.
          </ConsentBody>
        </ConsentOption>
        {errores['autorizaDatos'] === undefined ? null : (
          <FieldError id={idError('autorizaDatos')}>{errores['autorizaDatos']}</FieldError>
        )}
      </Seccion>
    </div>
  );
}
