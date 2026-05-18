import { toast as sonnerToast } from "sonner";

type ToastOptions = Parameters<typeof sonnerToast.success>[1];

/**
 * Wrapper personalizado para toast que agrega automáticamente
 * un botón "Marcar como leído" a todas las notificaciones
 */
const createToastWithReadAction = (
  toastFn: typeof sonnerToast.success,
  message: string,
  options?: ToastOptions
) => {
  // Si ya tiene una acción personalizada, no sobrescribirla
  if (options?.action) {
    return toastFn(message, options);
  }

  // Usar una referencia mutable para el ID del toast
  const toastIdRef: { current: string | number | undefined } = { current: undefined };

  const toastOptions: ToastOptions = {
    ...options,
    action: {
      label: "", // Texto vacío, el ícono se mostrará mediante CSS
      onClick: (event) => {
        // Encontrar el botón que se hizo clic
        const button = (event.target as HTMLElement).closest('button[data-action]') as HTMLElement;
        
        // Si el botón ya está marcado como leído, no hacer nada
        if (button?.hasAttribute('data-read')) {
          return;
        }
        
        // Marcar el botón como leído
        if (button) {
          button.setAttribute('data-read', 'true');
        }
        
        // Intentar encontrar el toast padre desde el evento
        const target = event.target as HTMLElement;
        const toastElement = target.closest('[data-sonner-toast]') as HTMLElement | null;
        
        // Cerrar el toast después de un breve delay para mostrar el cambio de estado
        setTimeout(() => {
          if (toastElement) {
            // Intentar obtener el ID del toast desde el atributo data-id
            const toastId = toastElement.getAttribute('data-id') || 
                           toastElement.getAttribute('id') ||
                           toastIdRef.current;
            
            if (toastId) {
              sonnerToast.dismiss(toastId);
            } else {
              // Si no hay ID, usar el elemento del DOM para cerrarlo
              toastElement.setAttribute('data-removed', 'true');
              toastElement.style.opacity = '0';
              toastElement.style.transform = 'translateX(100%)';
              setTimeout(() => {
                toastElement.remove();
              }, 200);
            }
          } else if (toastIdRef.current !== undefined) {
            // Usar el ID capturado
            sonnerToast.dismiss(toastIdRef.current);
          } else {
            // Último recurso: cerrar todos los toasts
            sonnerToast.dismiss();
          }
        }, 300); // Delay de 300ms para mostrar el cambio de estado
      },
    },
    duration: options?.duration ?? 5000, // Duración por defecto de 5 segundos
  };

  // Llamar al toast y capturar el ID que devuelve
  const toastId = toastFn(message, toastOptions);
  toastIdRef.current = toastId;

  // Agregar funcionalidad de swipe después de que el toast se renderice
  // Usar múltiples intentos para encontrar el elemento del toast específico
  const findAndSetupToast = (attempts = 0) => {
    // Buscar el toast más reciente que aún no tenga swipe configurado
    const allToasts = Array.from(document.querySelectorAll('[data-sonner-toast]')) as HTMLElement[];
    const toastElement = allToasts.find(toast => !toast.hasAttribute('data-swipe-setup'));
    
    if (toastElement) {
      toastElement.setAttribute('data-swipe-setup', 'true');
      addSwipeToDismiss(toastElement, toastId);
    } else if (attempts < 20) {
      setTimeout(() => findAndSetupToast(attempts + 1), 50);
    }
  };
  
  findAndSetupToast();

  return toastId;
};

/**
 * Agrega funcionalidad de swipe para cerrar el toast
 */
function addSwipeToDismiss(toastElement: HTMLElement, toastId: string | number) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let isSwiping = false;
  let currentTransform = { x: 0, y: 0 };
  let mouseDown = false;

  const handleStart = (clientX: number, clientY: number) => {
    touchStartX = clientX;
    touchStartY = clientY;
    isSwiping = true;
    toastElement.style.transition = 'none';
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isSwiping) return;
    
    touchEndX = clientX;
    touchEndY = clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Solo permitir swipe hacia la derecha o hacia arriba
    if (deltaX > 0 || deltaY < 0) {
      currentTransform.x = deltaX;
      currentTransform.y = deltaY;
      
      // Aplicar transformación
      toastElement.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px)`;
      const opacity = Math.max(0, 1 - Math.abs(deltaX) / 200 - Math.abs(deltaY) / 200);
      toastElement.style.opacity = `${opacity}`;
    }
  };

  const handleEnd = () => {
    if (!isSwiping) return;
    isSwiping = false;
    mouseDown = false;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const distanceX = Math.abs(deltaX);
    const distanceY = Math.abs(deltaY);
    
    // Umbral mínimo para considerar un swipe (50px)
    const minSwipeDistance = 50;
    
    // Verificar si es un swipe hacia la derecha o hacia arriba
    const isSwipeRight = deltaX > 0 && distanceX > minSwipeDistance;
    const isSwipeUp = deltaY < 0 && distanceY > minSwipeDistance;
    
    if (isSwipeRight || isSwipeUp) {
      // Cerrar el toast
      toastElement.style.transition = 'all 0.3s ease-out';
      toastElement.style.transform = isSwipeRight 
        ? `translateX(100%)` 
        : `translateY(-100%)`;
      toastElement.style.opacity = '0';
      
      setTimeout(() => {
        sonnerToast.dismiss(toastId);
      }, 300);
    } else {
      // Volver a la posición original
      toastElement.style.transition = 'all 0.3s ease-out';
      toastElement.style.transform = 'translate(0, 0)';
      toastElement.style.opacity = '1';
    }
    
    // Reset
    currentTransform = { x: 0, y: 0 };
  };

  // Touch events
  toastElement.addEventListener('touchstart', (e) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  toastElement.addEventListener('touchmove', (e) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  toastElement.addEventListener('touchend', handleEnd, { passive: true });

  // Mouse events (para desktop)
  toastElement.addEventListener('mousedown', (e) => {
    mouseDown = true;
    handleStart(e.clientX, e.clientY);
    e.preventDefault();
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (mouseDown && isSwiping) {
      handleMove(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    if (mouseDown) {
      handleEnd();
    }
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Limpiar listeners cuando el toast se elimine
  const observer = new MutationObserver(() => {
    if (!document.contains(toastElement)) {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

/**
 * Toast de éxito con botón "Marcar como leído"
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    return createToastWithReadAction(sonnerToast.success, message, options);
  },
  
  error: (message: string, options?: ToastOptions) => {
    return createToastWithReadAction(sonnerToast.error, message, options);
  },
  
  info: (message: string, options?: ToastOptions) => {
    return createToastWithReadAction(sonnerToast.info, message, options);
  },
  
  warning: (message: string, options?: ToastOptions) => {
    return createToastWithReadAction(sonnerToast.warning, message, options);
  },
  
  // Mantener compatibilidad con otros métodos de sonner
  promise: sonnerToast.promise,
  message: sonnerToast.message,
  custom: sonnerToast.custom,
  dismiss: sonnerToast.dismiss,
  loading: sonnerToast.loading,
};

