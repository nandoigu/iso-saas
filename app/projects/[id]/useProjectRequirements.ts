"use client";

import { useCallback, useEffect, useState } from "react";
import type { Requirement } from "@/app/projects/[id]/project-requirements";

export function useProjectRequirements(projectId: string) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadRequirements = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setLoadError("");

    try {
      const res = await fetch(`/api/requirements?projectId=${projectId}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error cargando requirements");
      }

      setRequirements(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error("Error cargando requirements:", error);
      setRequirements([]);
      setLoadError("No se pudieron cargar los requerimientos del proyecto.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  return {
    requirements,
    loading,
    loadError,
    reloadRequirements: loadRequirements,
  };
}
