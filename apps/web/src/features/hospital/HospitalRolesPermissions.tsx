import type { ReactNode } from 'react';

import { AdminAviso, hospitalAdminStyles as styles } from './HospitalAdminPieces';
import type { HospitalRolDescriptivo, HospitalRolesConfig } from './hospitalAdministrationConfig';
import { HospitalCard, HospitalCardHeader, HospitalNote } from './HospitalViewPieces';

/**
 * Bloque «Roles y permisos» (TASK-003H-05, FR-06; corrección final aprobada por
 * la Product Owner, apartados E y F).
 *
 * La corrección retira la estructura técnica `rol / módulo / acción / alcance /
 * descripción` como experiencia principal y la sustituye por una lectura
 * comprensible para una persona administrativa: para cada uno de los ocho
 * perfiles, qué puede y qué no puede hacer. También separa este bloque de
 * «Personal y accesos», que queda como la pantalla operativa cotidiana.
 *
 * Alcance: presentación. Estas descripciones no implementan ni garantizan
 * autorización: hoy no protegen ningún dato, no conceden ni revocan acceso y
 * asignar un rol no activa ni desactiva nada. El modelo definitivo de roles,
 * permisos y mínimo privilegio sigue pendiente de aprobación y deberá aplicarse
 * en servidor y en la capa de datos, con denegación por defecto.
 *
 * Las operaciones sensibles se enumeran como preparación visual de la
 * confirmación reforzada y del registro en Auditoría que exigirán en el futuro.
 * Ninguna existe todavía, ninguna se puede ejecutar aquí y no hay segundo
 * factor implementado.
 */

const ROLES_ID = 'hospital-admin-roles';
const SENSIBLES_ID = 'hospital-admin-acciones-sensibles';

/**
 * Ficha de un rol.
 *
 * Cada capacidad y cada límite se lee como texto, con su propio rótulo: el
 * significado nunca depende del color ni del signo que lo acompaña, que es
 * decorativo.
 */
function Rol({
  rol,
  etiquetaPuede,
  etiquetaNoPuede,
}: {
  readonly rol: HospitalRolDescriptivo;
  readonly etiquetaPuede: string;
  readonly etiquetaNoPuede: string;
}): ReactNode {
  const tituloId = `hospital-admin-rol-${rol.id}`;

  return (
    <li className={styles.rol}>
      <section aria-labelledby={tituloId} className={styles.rolCuerpo}>
        <h3 className={styles.rolTitulo} id={tituloId}>
          {rol.titulo}
        </h3>

        <div className={styles.rolListas}>
          <div className={styles.rolLista}>
            <p className={styles.rolEtiquetaPuede}>{etiquetaPuede}</p>
            <ul className={styles.rolItems}>
              {rol.puede.map((item) => (
                <li className={styles.rolItemPuede} key={item}>
                  <span className={styles.rolMarca} aria-hidden="true">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.rolLista}>
            <p className={styles.rolEtiquetaNoPuede}>{etiquetaNoPuede}</p>
            <ul className={styles.rolItems}>
              {rol.noPuede.map((item) => (
                <li className={styles.rolItemNoPuede} key={item}>
                  <span className={styles.rolMarca} aria-hidden="true">
                    —
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </li>
  );
}

export function HospitalRolesPermissions({
  config,
}: {
  readonly config: HospitalRolesConfig;
}): ReactNode {
  return (
    <div className={styles.panel}>
      <AdminAviso atencion>{config.aviso}</AdminAviso>

      <HospitalCard gap={16} aria-labelledby={ROLES_ID}>
        <HospitalCardHeader
          titulo={config.titulo}
          tituloId={ROLES_ID}
          nota={config.descripcion}
        />
        <ul className={styles.roles}>
          {config.items.map((rol) => (
            <Rol
              key={rol.id}
              rol={rol}
              etiquetaPuede={config.etiquetaPuede}
              etiquetaNoPuede={config.etiquetaNoPuede}
            />
          ))}
        </ul>
        <HospitalNote>{config.nota}</HospitalNote>
      </HospitalCard>

      <HospitalCard gap={14} aria-labelledby={SENSIBLES_ID}>
        <HospitalCardHeader
          titulo={config.sensibles.titulo}
          tituloId={SENSIBLES_ID}
          nota={config.sensibles.descripcion}
        />
        <ul className={styles.sensibles}>
          {config.sensibles.items.map((item) => (
            <li className={styles.sensible} key={item.id}>
              <span className={styles.sensibleEtiqueta}>{item.etiqueta}</span>
              <span className={styles.sensibleDetalle}>{item.detalle}</span>
              <span className={styles.sensibleBadge} data-hospital-confirmacion="reforzada">
                Confirmación reforzada
              </span>
            </li>
          ))}
        </ul>
        <HospitalNote>{config.sensibles.nota}</HospitalNote>
      </HospitalCard>
    </div>
  );
}
