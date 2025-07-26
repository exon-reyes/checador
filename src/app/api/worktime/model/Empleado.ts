// Estructura de los datos del empleado
import {TipoPausa} from './TipoPausa';

export interface Empleado {
  id: number;
  clave: string;
  nombre: string;
  jornadaIniciada: boolean;
  esNocturno: boolean;
  tipoPausa: TipoPausa | null; //
}
