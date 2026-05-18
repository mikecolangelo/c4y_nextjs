"use client";

import { useState, useTransition, useCallback } from "react";

// Polyfill de useActionState para React 18 (compatible con React 19 API)
export function useActionState<TState, TPayload = FormData>(
  action: (state: TState, payload: TPayload) => Promise<TState> | TState,
  initialState: TState
): [TState, (payload: TPayload) => void, boolean] {
  const [state, setState] = useState<TState>(initialState);
  const [isPending, startTransition] = useTransition();

  const dispatch = useCallback(
    (payload: TPayload) => {
      startTransition(async () => {
        try {
          const newState = await action(state, payload);
          setState(newState);
        } catch (error) {
          // Si la acción lanza un error, mantenemos el estado anterior
          // pero podríamos agregar manejo de errores aquí si es necesario
          throw error;
        }
      });
    },
    [action, state, startTransition]
  );

  return [state, dispatch, isPending];
}
