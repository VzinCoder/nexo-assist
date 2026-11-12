import { TZDate } from "@date-fns/tz";

/** Fuso do service desk. */
export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
/** Início do expediente (hora local, inclusiva). */
export const BUSINESS_START_HOUR = 8;
/** Fim do expediente (hora local, exclusiva). */
export const BUSINESS_END_HOUR = 18;
/** Horas úteis em um dia útil. */
export const BUSINESS_HOURS_PER_DAY = BUSINESS_END_HOUR - BUSINESS_START_HOUR;

const HOUR_MS = 60 * 60 * 1000;

function inZone(time: number): TZDate {
  return new TZDate(time, BUSINESS_TIME_ZONE);
}

function isWeekend(date: TZDate): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** 8h do dia seguinte (hora local). */
function nextDayStart(date: TZDate): TZDate {
  const next = inZone(date.getTime());
  next.setDate(next.getDate() + 1);
  next.setHours(BUSINESS_START_HOUR, 0, 0, 0);
  return next;
}

/** O próprio instante, se for útil; senão, o próximo início de expediente. */
function nextBusinessInstant(date: TZDate): TZDate {
  let cursor = inZone(date.getTime());
  for (;;) {
    if (isWeekend(cursor) || cursor.getHours() >= BUSINESS_END_HOUR) {
      cursor = nextDayStart(cursor);
      continue;
    }
    if (cursor.getHours() < BUSINESS_START_HOUR) {
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    }
    return cursor;
  }
}

/**
 * Soma horas úteis (seg–sex, 8h–18h, America/Sao_Paulo, sem feriados) a um instante.
 * Um início fora do expediente começa a contar no próximo início de expediente; quando o saldo
 * zera exatamente no fim do dia, o resultado é 18h daquele dia.
 */
export function addBusinessHours(start: Date, hours: number): Date {
  if (!Number.isFinite(hours) || hours < 0) {
    throw new RangeError("hours deve ser um número finito e não negativo.");
  }
  let remaining = hours * HOUR_MS;
  let cursor = nextBusinessInstant(inZone(start.getTime()));

  for (;;) {
    const endOfDay = inZone(cursor.getTime());
    endOfDay.setHours(BUSINESS_END_HOUR, 0, 0, 0);
    const available = endOfDay.getTime() - cursor.getTime();
    if (remaining <= available) {
      return new Date(cursor.getTime() + remaining);
    }
    remaining -= available;
    cursor = nextBusinessInstant(endOfDay);
  }
}
