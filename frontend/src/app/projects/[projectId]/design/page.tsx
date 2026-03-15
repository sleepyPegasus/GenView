"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function DesignRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}?tab=design`);
    }
  }, [projectId, router]);

  return null;
}
