import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import {
  Chip,
  ChipList,
  ConsentBody,
  ConsentOption,
  Segment,
  SegmentedGroup,
} from '@/components/ui/Choice';
import { EliSpeech } from '@/components/ui/Eli';
import { FieldError, FieldGroup } from '@/components/ui/Field';
import { nombreDepartamento, nombreMunicipio } from '@/data/divipola';

import { alternarEnLista, edadEnAnios, nombreCompleto, textoEdad } from '../inscripcionFlow';
import type { DatosCuidador } from '../inscripcionFlow';
import styles from '../inscripcion.module.css';
import {
  AccionDemostrativa,
  CampoLista,
  CampoTexto,
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
import type { PasoProps } from './PasosPaciente';

/**
 * Cinco pasos de la rama Cuidador (TASK-002A).
 *
 * Referencia: `prototype-claude/Eligeme-Inscripcion.dc.html`, vistas `c1`–`c5`.
 * No muestra diagnósticos, bitácora ni pantallas de la rama Paciente, y no
 * busca, crea ni vincula pacientes reales.
 *
 * Todos los datos solicitados son obligatorios (FR-04) y los campos
 * condicionales lo son mientras estén visibles. La ubicación usa el catálogo
 * local DANE DIVIPOLA (FR-04A).
 */

const TIPOS_DOCUMENTO = [
  'Cédula de ciudadanía',
  'Cédula de extranjería',
  'Pasaporte',
  'Permiso por Protección Temporal',
  'Otro',
];
const TIPOS_CUIDADOR = [
  'Familiar',
  'Cuidador informal',
  'Cuidador remunerado',
  'Auxiliar de enfermería',
  'Profesional de salud',
  'Otro',
];
const INSTITUCIONES = [
  'Formación SENA',
  'Institución de educación superior',
  'Fundación u ONG',
  'Hospital o ESE',
  'Otra',
];
const HORARIOS = ['Mañana', 'Tarde', 'Noche', 'Todo el día', 'Días específicos'];
const RELACIONES_PACIENTE = [
  'Madre',
  'Padre',
  'Hijo',
  'Hija',
  'Cónyuge',
  'Hermano',
  'Hermana',
  'Otro familiar',
  'Cuidador contratado',
  'Otro',
];
const RELACIONES_VECINO = [
  'Vecino',
  'Familiar',
  'Administrador',
  'Portero',
  'Líder comunitario',
  'Otro',
];

export function PasosCuidador({
  paso,
  valores,
  errores,
  dispatch,
  avisoId,
  hoy,
}: PasoProps<DatosCuidador>): ReactNode {
  const actualizar = (patch: Partial<DatosCuidador>): void => {
    dispatch({ type: 'actualizarCuidador', patch });
  };

  if (paso === 1) {
    return (
      <div className={styles.card}>
        <EliSpeech intencion="guia">
          Primero tú como persona. Después vinculamos al paciente o pacientes que cuidas.
        </EliSpeech>

        <RequiredLegend />

        <Seccion eyebrow="A · INFORMACIÓN DEL CUIDADOR">
          <Fila>
            <FilaItem>
              <CampoLista
                campo="tipoDocumento"
                label="Tipo de documento"
                value={valores.tipoDocumento}
                options={TIPOS_DOCUMENTO}
                onChange={(tipoDocumento) => actualizar({ tipoDocumento })}
              />
            </FilaItem>
            <FilaItem>
              <CampoTexto
                campo="documento"
                label="Número de documento"
                placeholder="Ej. 52988431"
                inputMode="numeric"
                value={valores.documento}
                error={errores['documento']}
                onChange={(documento) => actualizar({ documento })}
              />
            </FilaItem>
          </Fila>
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="nombres"
                label="Nombres"
                placeholder="Ej. Lucía"
                value={valores.nombres}
                error={errores['nombres']}
                onChange={(nombres) => actualizar({ nombres })}
              />
            </FilaItem>
            <FilaItem>
              <CampoTexto
                campo="apellidos"
                label="Apellidos"
                placeholder="Ej. Castro"
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
                  dispatch({ type: 'fechaNacimiento', valor, edad: edadEnAnios(valor, hoy) })
                }
              />
            </FilaItem>
            <p className={styles.ageBadge}>{textoEdad(valores.edad)}</p>
          </Fila>
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="telefono"
                label="Teléfono celular"
                placeholder="Ej. 301 552 8899"
                inputMode="tel"
                value={valores.telefono}
                error={errores['telefono']}
                onChange={(telefono) => actualizar({ telefono })}
              />
            </FilaItem>
            <FilaItem>
              <CampoTexto
                campo="correo"
                label="Correo electrónico"
                placeholder="Ej. lucia.castro@correo.com"
                tipo="email"
                inputMode="email"
                value={valores.correo}
                error={errores['correo']}
                onChange={(correo) => actualizar({ correo })}
              />
            </FilaItem>
          </Fila>
          <GrupoUbicacion
            grupo="principal"
            prefijo="cuidador"
            ubicacion={valores.ubicacion}
            errores={errores}
            dispatch={dispatch}
          />
          <CampoTexto
            campo="direccion"
            label="Dirección"
            placeholder="Su dirección de residencia"
            value={valores.direccion}
            error={errores['direccion']}
            onChange={(direccion) => actualizar({ direccion })}
          />
        </Seccion>
      </div>
    );
  }

  if (paso === 2) {
    return (
      <div className={styles.card}>
        <RequiredLegend />

        <Seccion eyebrow="B · TIPO DE CUIDADOR">
          <CampoLista
            campo="tipoCuidador"
            label="¿Qué tipo de cuidador es?"
            value={valores.tipoCuidador}
            options={TIPOS_CUIDADOR}
            error={errores['tipoCuidador']}
            onChange={(tipoCuidador) => actualizar({ tipoCuidador })}
          />
        </Seccion>

        <Separador />

        <Seccion eyebrow="C · FORMACIÓN">
          <FieldGroup
            legend="¿Cuenta con formación o certificación como cuidador? *"
            describedBy={
              errores['tieneFormacion'] === undefined ? undefined : idError('tieneFormacion')
            }
          >
            <SegmentedGroup>
              {['Sí', 'No'].map((opcion) => (
                <Segment
                  key={opcion}
                  name="tieneFormacion"
                  value={opcion}
                  checked={valores.tieneFormacion === opcion}
                  onChange={() => actualizar({ tieneFormacion: opcion })}
                  label={opcion}
                />
              ))}
            </SegmentedGroup>
          </FieldGroup>
          <ErrorGrupo campo="tieneFormacion" mensaje={errores['tieneFormacion']} />

          {valores.tieneFormacion === 'Sí' ? (
            <SubPanel>
              <CampoLista
                campo="institucionFormacion"
                label="Institución"
                value={valores.institucionFormacion}
                options={INSTITUCIONES}
                error={errores['institucionFormacion']}
                onChange={(institucionFormacion) => actualizar({ institucionFormacion })}
              />
              <Fila>
                <FilaItem>
                  <CampoTexto
                    campo="tipoCertificacion"
                    label="Tipo de certificación"
                    placeholder="Ej. Cuidado del adulto mayor"
                    value={valores.tipoCertificacion}
                    error={errores['tipoCertificacion']}
                    onChange={(tipoCertificacion) => actualizar({ tipoCertificacion })}
                  />
                </FilaItem>
                <FilaItem>
                  <CampoTexto
                    campo="fechaCertificacion"
                    label="Fecha de certificación"
                    tipo="date"
                    value={valores.fechaCertificacion}
                    error={errores['fechaCertificacion']}
                    onChange={(fechaCertificacion) => actualizar({ fechaCertificacion })}
                  />
                </FilaItem>
              </Fila>
              <p className={styles.blockBody}>
                El soporte se puede cargar más adelante desde su perfil.
              </p>
            </SubPanel>
          ) : null}
        </Seccion>

        <Separador />

        <Seccion eyebrow="E · DISPONIBILIDAD">
          <FieldGroup
            legend="¿Vive con el paciente? *"
            describedBy={
              errores['viveConPaciente'] === undefined
                ? undefined
                : idError('viveConPaciente')
            }
          >
            <SegmentedGroup>
              {['Sí', 'No'].map((opcion) => (
                <Segment
                  key={opcion}
                  name="viveConPaciente"
                  value={opcion}
                  checked={valores.viveConPaciente === opcion}
                  onChange={() => actualizar({ viveConPaciente: opcion })}
                  label={opcion}
                />
              ))}
            </SegmentedGroup>
          </FieldGroup>
          <ErrorGrupo campo="viveConPaciente" mensaje={errores['viveConPaciente']} />

          <FieldGroup
            legend="Horario habitual de cuidado · puede marcar varios *"
            describedBy={
              errores['horarios'] === undefined ? undefined : idError('horarios')
            }
          >
            <ChipList>
              {HORARIOS.map((horario) => (
                <Chip
                  key={horario}
                  name="horarios"
                  value={horario}
                  checked={valores.horarios.includes(horario)}
                  onChange={() =>
                    actualizar({ horarios: alternarEnLista(valores.horarios, horario) })
                  }
                  label={horario}
                />
              ))}
            </ChipList>
          </FieldGroup>
          <ErrorGrupo campo="horarios" mensaje={errores['horarios']} />
        </Seccion>
      </div>
    );
  }

  if (paso === 3) {
    return (
      <div className={styles.card}>
        <RequiredLegend />

        <Seccion eyebrow="D · PACIENTE AL QUE CUIDA">
          <FieldGroup
            legend="¿El paciente ya está registrado? *"
            describedBy={
              errores['pacienteRegistrado'] === undefined
                ? undefined
                : idError('pacienteRegistrado')
            }
          >
            <SegmentedGroup>
              {['Sí', 'No', 'No sabe'].map((opcion) => (
                <Segment
                  key={opcion}
                  name="pacienteRegistrado"
                  value={opcion}
                  checked={valores.pacienteRegistrado === opcion}
                  onChange={() => actualizar({ pacienteRegistrado: opcion })}
                  label={opcion}
                />
              ))}
            </SegmentedGroup>
          </FieldGroup>
          <ErrorGrupo campo="pacienteRegistrado" mensaje={errores['pacienteRegistrado']} />

          {valores.pacienteRegistrado === 'Sí' ? (
            <SubPanel>
              <p className={styles.blockBody}>
                La búsqueda del paciente no está disponible en esta demostración: no se
                consulta ningún registro y no se crea ningún vínculo.
              </p>
              <AccionDemostrativa avisoId={avisoId}>Buscar al paciente</AccionDemostrativa>
            </SubPanel>
          ) : null}

          {valores.pacienteRegistrado === 'No' ? (
            <SubPanel>
              <p className={styles.blockBody}>
                Podrá iniciar el registro básico del paciente más adelante. Aquí no se crea
                ninguna ficha.
              </p>
            </SubPanel>
          ) : null}

          <CampoLista
            campo="relacionPaciente"
            label="Relación con el paciente"
            value={valores.relacionPaciente}
            options={RELACIONES_PACIENTE}
            error={errores['relacionPaciente']}
            onChange={(relacionPaciente) => actualizar({ relacionPaciente })}
          />
        </Seccion>
      </div>
    );
  }

  if (paso === 4) {
    return (
      <div className={styles.card}>
        <RequiredLegend />

        <PanelObligatorio
          eyebrow="F · OBLIGATORIO"
          titulo="Contacto cercano al domicilio del paciente"
          descripcion="No es un vecino suyo: debe ser una persona que viva cerca del paciente y pueda ayudar a localizarlo cuando ni el paciente ni usted respondan."
        >
          <CampoTexto
            campo="vecinoNombre"
            label="Nombre"
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
              Autorizo el uso de este contacto exclusivamente para localizar al paciente y
              apoyar su atención.
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
              <p className={styles.reviewLabel}>CUIDADOR</p>
              <p className={styles.reviewValue}>{nombreCompleto(valores)}</p>
              <p className={styles.reviewLabel}>
                {`${valores.documento || 'Sin documento'} · ${valores.telefono || 'Sin teléfono'}`}
              </p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 1 })}>
              Editar
              <span className="merdn-sr-only"> los datos del cuidador</span>
            </Button>
          </li>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>UBICACIÓN</p>
              <p className={styles.reviewValue}>{territorio}</p>
              <p className={styles.reviewLabel}>
                {`Corregimiento: ${valores.ubicacion.corregimiento || 'Sin corregimiento'}`}
              </p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 1 })}>
              Editar
              <span className="merdn-sr-only"> la ubicación del cuidador</span>
            </Button>
          </li>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>PERFIL</p>
              <p className={styles.reviewValue}>
                {`${valores.tipoCuidador} · Formación: ${valores.tieneFormacion || 'Sin responder'}`}
              </p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 2 })}>
              Editar
              <span className="merdn-sr-only"> el perfil del cuidador</span>
            </Button>
          </li>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>PACIENTE</p>
              <p className={styles.reviewValue}>
                {`Relación: ${valores.relacionPaciente} · Registrado: ${valores.pacienteRegistrado || 'Sin responder'}`}
              </p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 3 })}>
              Editar
              <span className="merdn-sr-only"> la información del paciente</span>
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
          title="Tratamiento de datos personales"
        >
          <ConsentBody>
            Autorizo el tratamiento de los datos personales conforme a la Ley 1581 de 2012.
          </ConsentBody>
        </ConsentOption>
        {errores['autorizaDatos'] === undefined ? null : (
          <FieldError id={idError('autorizaDatos')}>{errores['autorizaDatos']}</FieldError>
        )}
      </Seccion>
    </div>
  );
}
