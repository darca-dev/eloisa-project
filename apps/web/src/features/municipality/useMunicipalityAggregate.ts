'use client';

import { useEffect, useState } from 'react';

import type { EstadoAgregado } from './municipalityAggregates';
import type { ResultadoAgregado } from './municipalityAggregatesClient';

/**
 * Estado de una consulta municipal agregada
 * (TASK-MUNICIPALITY-CORE-01, FR-11 y FR-12).
 *
 * El primer render es SIEMPRE `cargando`, también en servidor: la vista no
 * puede pintar una cifra antes de tenerla, y no existe ningún valor de diseño
 * con el que rellenar el hueco mientras tanto.
 *
 * La consulta se cancela al desmontar para que una respuesta tardía no escriba
 * sobre una vista que ya no está en pantalla.
 *
 * `consultar` debe ser una función estable —declarada en el módulo de la vista,
 * no en su cuerpo—: es la dependencia del efecto y una nueva identidad en cada
 * render relanzaría la consulta indefinidamente.
 */
export function useMunicipalityAggregate<T>(
  consultar: (signal: AbortSignal) => Promise<ResultadoAgregado<T>>,
): EstadoAgregado<T> {
  const [estado, setEstado] = useState<EstadoAgregado<T>>({ estado: 'cargando' });

  useEffect(() => {
    const controller = new AbortController();
    let vigente = true;

    void consultar(controller.signal).then((resultado) => {
      if (!vigente) {
        return;
      }

      if (resultado.kind === 'ok') {
        setEstado({ estado: 'listo', datos: resultado.datos });

        return;
      }

      setEstado(
        resultado.kind === 'no-autorizado' ? { estado: 'no-autorizado' } : { estado: 'error' },
      );
    });

    return (): void => {
      vigente = false;
      controller.abort();
    };
  }, [consultar]);

  return estado;
}
