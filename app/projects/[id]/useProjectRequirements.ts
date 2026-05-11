"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Requirement } from "@/app/projects/[id]/project-requirements";

export function useProjectRequirements(projectId: string) {
  const router = useRouter();
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

      if (res.status === 401 || res.status === 403) {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace(
          `/login?next=${encodeURIComponent(window.location.pathname)}`
        );
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error cargando requirements");
      }

      setRequirements(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando requirements:", error);
      setRequirements([]);
      setLoadError("No se pudieron cargar los requerimientos del proyecto.");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

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
