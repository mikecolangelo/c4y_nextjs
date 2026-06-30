"use client";

import { useCallback, useEffect, useState } from "react";
import type { ServiceCard } from "@/validations/types";
import { toast } from "@/lib/toast";
import { clientLogger } from "@/lib/client-logger";
import { fetchServices } from "../api/services.client";

/**
 * Loads the service catalog and exposes a `reload` callback.
 *
 * Owns the data-fetching concern so components only deal with presentation.
 * On failure it surfaces a toast and resets to an empty list.
 */
export function useServices() {
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      setServices(await fetchServices());
    } catch (error) {
      clientLogger.error("Error loading services:", error);
      toast.error("No pudimos cargar los servicios. Intenta nuevamente.");
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { services, isLoading, reload };
}
