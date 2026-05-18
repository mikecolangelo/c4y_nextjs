import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Formatea la hora en formato de 12 horas (AM/PM)
 */
export function formatTime12Hour(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes.toString().padStart(2, "0");
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

/**
 * Verifica si una fecha es "todo el día" (00:00:00)
 */
export function isAllDay(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
}

/**
 * Formatea una fecha de forma legible
 */
export function formatReminderDate(dateString: string): string {
  const date = new Date(dateString);
  const allDay = isAllDay(date);
  
  if (allDay) {
    return `${format(date, "d 'de' MMMM, yyyy", { locale: es })} - todo el día`;
  }
  
  return `${format(date, "d 'de' MMMM, yyyy 'a las'", { locale: es })} ${formatTime12Hour(date)}`;
}

/**
 * Formatea una fecha de forma corta
 */
export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  const allDay = isAllDay(date);
  
  if (allDay) {
    return format(date, "d MMM", { locale: es });
  }
  
  return `${format(date, "d MMM", { locale: es })} ${formatTime12Hour(date)}`;
}

/**
 * Calcula el tiempo relativo desde ahora
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(Math.abs(diffMs) / 60000);
  const diffHours = Math.floor(Math.abs(diffMs) / 3600000);
  const diffDays = Math.floor(Math.abs(diffMs) / 86400000);
  const isPast = diffMs < 0;

  if (Math.abs(diffMins) < 1) {
    return "Ahora";
  } else if (diffMins < 60) {
    return isPast ? `Hace ${diffMins} min` : `En ${diffMins} min`;
  } else if (diffHours < 24) {
    return isPast 
      ? `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`
      : `En ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  } else if (diffDays === 1) {
    return isPast ? "Ayer" : "Mañana";
  } else if (diffDays < 7) {
    return isPast ? `Hace ${diffDays} días` : `En ${diffDays} días`;
  } else {
    return formatShortDate(dateString);
  }
}















