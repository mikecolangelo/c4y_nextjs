/**
 * Convierte hora de formato 24h a formato 12h AM/PM
 */
export function formatTime12Hour(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? "PM" : "AM";
  const minutesStr = String(minutes).padStart(2, "0");
  return `${hour12}:${minutesStr} ${period}`;
}

/**
 * Detecta si una fecha es "todo el día" (hora es 00:00)
 */
export function isAllDay(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0;
}

















