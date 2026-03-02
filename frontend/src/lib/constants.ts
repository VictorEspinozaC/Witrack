export const SHIPMENT_STATES = [
  'agendado', 'en_puerta', 'en_patio', 'en_carga',
  'carga_terminada', 'emision_guia', 'espera_salida', 'en_ruta', 'en_recepcion'
] as const;

export type ShipmentStatus = typeof SHIPMENT_STATES[number];

export const STATE_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  agendado:        ['en_puerta'],
  en_puerta:       ['en_patio'],
  en_patio:        ['en_carga'],
  en_carga:        ['carga_terminada'],
  carga_terminada: ['emision_guia'],
  emision_guia:    ['espera_salida'],
  espera_salida:   ['en_ruta'],
  en_ruta:         ['en_recepcion'],
  en_recepcion:    [],
};

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  agendado:        'Agendado',
  en_puerta:       'En Puerta',
  en_patio:        'En Patio',
  en_carga:        'En Carga',
  carga_terminada: 'Carga Terminada',
  emision_guia:    'Emisión Guía',
  espera_salida:   'Espera Salida',
  en_ruta:         'En Ruta',
  en_recepcion:    'En Recepción',
};

export const STATUS_COLORS: Record<ShipmentStatus, { bg: string; text: string; border: string }> = {
  agendado:        { bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300' },
  en_puerta:       { bg: 'bg-yellow-100',  text: 'text-yellow-800',  border: 'border-yellow-300' },
  en_patio:        { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300' },
  en_carga:        { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-300' },
  carga_terminada: { bg: 'bg-green-100',   text: 'text-green-800',   border: 'border-green-300' },
  emision_guia:    { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-300' },
  espera_salida:   { bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-cyan-300' },
  en_ruta:         { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  en_recepcion:    { bg: 'bg-sky-100',     text: 'text-sky-800',     border: 'border-sky-300' },
};

export const STATUS_DOT_COLORS: Record<ShipmentStatus, string> = {
  agendado:        'bg-slate-500',
  en_puerta:       'bg-yellow-500',
  en_patio:        'bg-blue-500',
  en_carga:        'bg-orange-500',
  carga_terminada: 'bg-green-500',
  emision_guia:    'bg-teal-500',
  espera_salida:   'bg-cyan-500',
  en_ruta:         'bg-emerald-500',
  en_recepcion:    'bg-sky-500',
};

export const TRANSITION_ACTIONS: Partial<Record<ShipmentStatus, string>> = {
  agendado:        'Registrar Llegada',
  en_puerta:       'Ingresar al Patio',
  en_patio:        'Iniciar Carga',
  en_carga:        'Finalizar Carga',
  carga_terminada: 'Emitir Guía',
  emision_guia:    'Listo para Salir',
  espera_salida:   'Despachar',
  en_ruta:         'Llegó al Destino',
};

export const INCIDENT_TYPES = [
  { value: 'damage', label: 'Dano en mercancia' },
  { value: 'delay', label: 'Retraso' },
  { value: 'documentation', label: 'Documentacion mala' },
  { value: 'accident', label: 'Choque / Accidente' },
  { value: 'other', label: 'Otro' },
] as const;

export const USER_ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'planta', label: 'Planta' },
  { value: 'sucursal', label: 'Sucursal' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'chofer', label: 'Chofer' },
] as const;

export const ORDER_CONFIRMATION_STATUS = {
  pending_approval: { label: 'Pendiente Aprobacion', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  approved:         { label: 'Aprobado',             color: 'bg-green-100 text-green-800 border-green-300' },
  rejected:         { label: 'Rechazado',            color: 'bg-red-100 text-red-800 border-red-300' },
} as const;

export type OrderConfirmationStatus = keyof typeof ORDER_CONFIRMATION_STATUS;
