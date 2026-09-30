import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Chip, ChipList, ConsentBody, ConsentOption } from '@/components/ui/Choice';
import { FieldError, FieldGroup } from '@/components/ui/Field';
import { nombreDepartamento, nombreMunicipio } from '@/data/divipola';

import { alternarEnLista, nombreCompleto } from '../inscripcionFlow';
import type { DatosVisitador } from '../inscripcionFlow';
import { VISITADORES_DEMO } from '../otherDemoFixtures';
import styles from '../inscripcion.module.css';
import {
  AccionDemostrativa,
  CampoLista,
  CampoTexto,
  Fila,
  FilaItem,
  GrupoUbicacion,
  RequiredLegend,
  Seccion,
  Separador,
  idCampo,
  idError,
} from './piezas';
import type { PasoProps } from './PasosPaciente';

/**
 * Cinco pasos de la rama Visitador médico (TASK-002A).
 *
 * Referencia: `prototype-claude/Eligeme-Inscripcion.dc.html`, vistas `v1`–`v5`.
 * No verifica credenciales, no habilita permisos y no muestra pantallas de las
 * ramas Paciente o Cuidador.
 *
 * Esta rama conserva la obligatoriedad de su flujo aprobado: la regla de «todos
 * los datos son obligatorios» se decidió solo para Paciente y Cuidador. Lo
 * único que se añade aquí es lo que FR-04A exige en las tres ramas —
 * Departamento y Municipio de cada grupo de ubicación—, sin inventar
 * requisitos de acreditación.
 */

const TIPOS_DOCUMENTO = ['Cédula de ciudadanía', 'Cédula de extranjería', 'Pasaporte', 'Otro'];
const PROFESIONES = [
  'Médico',
  'Enfermero',
  'Auxiliar de enfermería',
  'Fisioterapeuta',
  'Terapeuta ocupacional',
  'Trabajador social',
  'Psicólogo',
  'Nutricionista',
  'Otro',
];
const TIPOS_ATENCION = [
  'Visita médica domiciliaria',
  'Seguimiento al paciente',
  'Enfermería',
  'Valoración inicial',
  'Control de medicamentos',
  'Rehabilitación',
  'Trabajo social',
  'Verificación de condiciones domiciliarias',
  'Otro',
];
const EPS = [
  'Nueva EPS',
  'Sanitas',
  'Sura',
  'Salud Total',
  'Compensar',
  'Famisanar',
  'Otra EPS',
];
const ZONAS = ['Comuna urbana', 'Cabecera municipal', 'Centro poblado', 'Zona rural dispersa'];
const DOCUMENTOS = [
  'Documento de identidad',
  'Tarjeta profesional',
  'Certificación laboral o vínculo con EPS, IPS, ESE u hospital',
];

export function PasosVisitador({
  paso,
  valores,
  errores,
  dispatch,
  avisoId,
}: PasoProps<DatosVisitador>): ReactNode {
  const actualizar = (patch: Partial<DatosVisitador>): void => {
    dispatch({ type: 'actualizarVisitador', patch });
  };

  if (paso === 1) {
    return (
      <div className={styles.card}>
        <section className={styles.demoProfiles} aria-labelledby="visitadores-demo-title">
          <p id="visitadores-demo-title" className={styles.eyebrow}>VISITADORES DEMO</p>
          <p className={styles.demoProfilesText}>Cargue datos ficticios para recorrer este formulario sin rellenarlo a mano. Esta ruta guiada todavía no envía la solicitud al Hospital.</p>
          <div className={styles.demoProfilesActions}>
            {VISITADORES_DEMO.map((visitador) => (
              <Button key={visitador.id} variant="outline" onClick={() => actualizar(visitador.valores)}>
                {visitador.etiqueta}
              </Button>
            ))}
          </div>
        </section>
        <p className={styles.warning}>
          Este registro requiere verificación. Su cuenta quedaría pendiente de verificación
          hasta que la plataforma o su institución validen los datos.
        </p>

        <RequiredLegend />

        <Seccion eyebrow="A · INFORMACIÓN PERSONAL">
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
                placeholder="Ej. 79884512"
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
                placeholder="Ej. Alejandro"
                value={valores.nombres}
                error={errores['nombres']}
                onChange={(nombres) => actualizar({ nombres })}
              />
            </FilaItem>
            <FilaItem>
              <CampoTexto
                campo="apellidos"
                label="Apellidos"
                placeholder="Ej. Gómez"
                obligatorio={false}
                value={valores.apellidos}
                onChange={(apellidos) => actualizar({ apellidos })}
              />
            </FilaItem>
          </Fila>
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="telefono"
                label="Teléfono"
                placeholder="Ej. 315 990 1122"
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
                placeholder="Preferiblemente institucional"
                tipo="email"
                inputMode="email"
                obligatorio={false}
                value={valores.correo}
                onChange={(correo) => actualizar({ correo })}
              />
            </FilaItem>
          </Fila>
        </Seccion>
      </div>
    );
  }

  if (paso === 2) {
    return (
      <div className={styles.card}>
        <Seccion eyebrow="B · PERFIL PROFESIONAL">
          <CampoLista
            campo="profesion"
            label="Profesión"
            value={valores.profesion}
            options={PROFESIONES}
            obligatorio={false}
            onChange={(profesion) => actualizar({ profesion })}
          />
          <Fila>
            <FilaItem>
              <CampoTexto
                campo="tarjetaProfesional"
                label="Número de tarjeta profesional"
                placeholder="Cuando corresponda"
                obligatorio={false}
                value={valores.tarjetaProfesional}
                onChange={(tarjetaProfesional) => actualizar({ tarjetaProfesional })}
              />
            </FilaItem>
            <FilaItem>
              <CampoTexto
                campo="registroProfesional"
                label="Número de registro profesional"
                placeholder="Si aplica"
                obligatorio={false}
                value={valores.registroProfesional}
                onChange={(registroProfesional) => actualizar({ registroProfesional })}
              />
            </FilaItem>
          </Fila>
          <FieldGroup legend="Tipo de atención que realiza · puede marcar varios">
            <ChipList>
              {TIPOS_ATENCION.map((tipo) => (
                <Chip
                  key={tipo}
                  name="tiposAtencion"
                  value={tipo}
                  checked={valores.tiposAtencion.includes(tipo)}
                  onChange={() =>
                    actualizar({ tiposAtencion: alternarEnLista(valores.tiposAtencion, tipo) })
                  }
                  label={tipo}
                />
              ))}
            </ChipList>
          </FieldGroup>
        </Seccion>
      </div>
    );
  }

  if (paso === 3) {
    return (
      <div className={styles.card}>
        <RequiredLegend />

        <Seccion eyebrow="C · EPS">
          <CampoLista
            campo="eps"
            label="EPS a la que pertenece o para la cual presta servicios"
            value={valores.eps}
            options={EPS}
            obligatorio={false}
            onChange={(eps) => actualizar({ eps })}
          />
          {valores.eps === 'Otra EPS' ? (
            <CampoTexto
              campo="otraEps"
              label="Escriba el nombre de la EPS"
              placeholder="Nombre de la EPS"
              obligatorio={false}
              value={valores.otraEps}
              onChange={(otraEps) => actualizar({ otraEps })}
            />
          ) : null}
        </Seccion>

        <Separador />

        <Seccion eyebrow="D · INSTITUCIÓN DONDE TRABAJA">
          <p className={styles.note}>
            La institución se registra aparte de la EPS: una IPS o ESE puede atender pacientes
            afiliados a varias EPS.
          </p>
          <CampoTexto
            campo="institucion"
            label="Hospital, ESE, IPS o institución"
            placeholder="Ej. ESE Hospital municipal"
            obligatorio={false}
            value={valores.institucion}
            onChange={(institucion) => actualizar({ institucion })}
          />
          <GrupoUbicacion
            grupo="institucion"
            prefijo="institucion"
            ubicacion={valores.ubicacionInstitucion}
            errores={errores}
            dispatch={dispatch}
            corregimientoObligatorio={false}
          />
          <CampoTexto
            campo="cargo"
            label="Cargo"
            placeholder="Ej. Médico domiciliario"
            obligatorio={false}
            value={valores.cargo}
            onChange={(cargo) => actualizar({ cargo })}
          />
        </Seccion>
      </div>
    );
  }

  if (paso === 4) {
    return (
      <div className={styles.card}>
        <RequiredLegend />

        <Seccion eyebrow="E · ZONA DE ATENCIÓN">
          <GrupoUbicacion
            grupo="principal"
            prefijo="zona"
            ubicacion={valores.ubicacion}
            errores={errores}
            dispatch={dispatch}
            etiquetaMunicipio="Municipio principal"
            corregimientoObligatorio={false}
          />
          <FieldGroup legend="Tipo de zona que cubre · puede marcar varios">
            <ChipList>
              {ZONAS.map((zona) => (
                <Chip
                  key={zona}
                  name="zonas"
                  value={zona}
                  checked={valores.zonas.includes(zona)}
                  onChange={() => actualizar({ zonas: alternarEnLista(valores.zonas, zona) })}
                  label={zona}
                />
              ))}
            </ChipList>
          </FieldGroup>
          <CampoTexto
            campo="sector"
            label="Zona o sector asignado"
            placeholder="Ej. Sector nororiental"
            obligatorio={false}
            value={valores.sector}
            onChange={(sector) => actualizar({ sector })}
          />
        </Seccion>
      </div>
    );
  }

  const municipio = nombreMunicipio(valores.ubicacion.municipio);
  const departamento = nombreDepartamento(valores.ubicacion.departamento);
  const territorio =
    municipio.length === 0 ? 'Sin municipio' : `${municipio} (${departamento})`;

  return (
    <div className={styles.card}>
      <Seccion eyebrow="G · DOCUMENTACIÓN">
        <p className={styles.blockBody}>
          La carga de documentos no está disponible en esta demostración: no se envía ni se
          almacena ningún archivo.
        </p>
        <ul className={styles.uploadList}>
          {DOCUMENTOS.map((documento) => (
            <li key={documento} className={styles.uploadRow}>
              <span className={styles.uploadName}>{documento}</span>
              <AccionDemostrativa avisoId={avisoId} variant="pill">
                Cargar
                <span className="merdn-sr-only">{` ${documento}`}</span>
              </AccionDemostrativa>
            </li>
          ))}
        </ul>
      </Seccion>

      <Separador />

      <Seccion eyebrow="REVISE SU INFORMACIÓN">
        <ul className={styles.review}>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>VISITADOR</p>
              <p className={styles.reviewValue}>{nombreCompleto(valores)}</p>
              <p className={styles.reviewLabel}>
                {`${valores.profesion} · ${valores.documento || 'Sin documento'}`}
              </p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 1 })}>
              Editar
              <span className="merdn-sr-only"> los datos personales</span>
            </Button>
          </li>
          <li className={styles.reviewRow}>
            <div className={styles.reviewTexts}>
              <p className={styles.reviewLabel}>INSTITUCIÓN Y ZONA</p>
              <p className={styles.reviewValue}>
                {`${valores.institucion || 'Sin institución'} · ${territorio}`}
              </p>
            </div>
            <Button variant="pill" onClick={() => dispatch({ type: 'irAPaso', paso: 3 })}>
              Editar
              <span className="merdn-sr-only"> la institución y la zona</span>
            </Button>
          </li>
        </ul>
      </Seccion>

      <Separador />

      <Seccion eyebrow="H · AUTORIZACIÓN">
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
            Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.
          </ConsentBody>
        </ConsentOption>
        {errores['autorizaDatos'] === undefined ? null : (
          <FieldError id={idError('autorizaDatos')}>{errores['autorizaDatos']}</FieldError>
        )}
      </Seccion>
    </div>
  );
}
