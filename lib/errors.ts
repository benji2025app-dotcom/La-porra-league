// Traduce los errores de la base de datos (códigos de las funciones de la porra) a mensajes para el usuario.
const MESSAGES: Record<string, string> = {
  PREDICTION_LOCKED: 'El partido ya ha empezado: tu pronóstico está bloqueado.',
  ROUND_NOT_OPEN: 'Esta jornada no está abierta.',
  INVALID_SCORE: 'Cada marcador debe estar entre 0 y 20.',
  NOT_ACTIVE_MEMBER: 'Tu cuenta aún no está aprobada.',
  NOT_LEAGUE_MEMBER: 'No juegas en esta porra.',
  CLUB_NOT_IN_LEAGUE: 'Ese club no es de esta porra.',
  CLUB_NOT_PLAYING: 'El club de la porra tiene que ser el local o el visitante.',
  LEAGUE_NOT_FOUND: 'Esa porra no existe.',
  ROUND_NOT_FOUND: 'Esa jornada no existe.',
  USER_NOT_FOUND: 'Ese jugador no existe.',
  FIXTURE_NOT_FOUND: 'Ese partido no existe.',
  FORBIDDEN: 'Solo el administrador puede hacer esto.',
  ROUND_NEEDS_TWO_FIXTURES: 'La jornada necesita un partido de cada club de la porra.',
  FIXTURES_NOT_FINISHED: 'Faltan resultados: marca los dos partidos como terminados.',
  ROUND_CLOSED: 'La jornada ya está cerrada.',
  ROUND_NOT_DRAFT: 'Solo se puede borrar en borrador.',
  ROUND_MUST_START_AS_DRAFT: 'La jornada debe crearse en borrador.',
  ROUND_HAS_PREDICTIONS: 'Ya hay pronósticos: no se puede volver a borrador.',
  KICKOFF_IN_PAST: 'La hora de inicio tiene que ser futura.',
  FIXTURE_LOCKED: 'El partido ya ha empezado: no se puede cambiar.',
  USE_REPLACE_FIXTURE: 'Ya hay pronósticos para este partido. Usa "Sustituir partido".',
  FIXTURE_HAS_PREDICTIONS: 'Ya hay pronósticos para este partido.',
  RESULT_BEFORE_KICKOFF: 'No se puede poner el resultado antes del inicio.',
  ONLY_LATEST_ROUND: 'Solo se puede reabrir la última jornada cerrada.',
  ROUND_NOT_CLOSED: 'La jornada no está cerrada.',
  VOID_REASON_REQUIRED: 'Escribe el motivo de la anulación.',
  INVITE_CODE_REQUIRED: 'Este jugador aún no ha canjeado un código de invitación.',
  CANNOT_CHANGE_OWN_STATUS: 'No puedes cambiar tu propio estado.',
  CANNOT_DEMOTE_SELF: 'No puedes quitarte el rol de administrador.',
  POT_NEGATIVE: 'El bote no puede quedar en negativo.',
  NOTE_REQUIRED: 'Escribe el motivo del ajuste.',
  INVALID_AMOUNT: 'Importe no válido.',
  INVALID_INVITE_CODE: 'El código de invitación no es válido o ha caducado.',
}

export function dbError(error: { message?: string; code?: string } | null | undefined, fallback = 'No se ha podido completar la operación.') {
  if (!error) return fallback
  const msg = error.message ?? ''
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k))
  if (key) return MESSAGES[key]
  if (error.code === '23505') return 'Ya existe un registro igual (revisa el número de jornada o el partido de ese club).'
  if (msg.includes('row-level security')) return MESSAGES.FORBIDDEN
  return fallback
}
