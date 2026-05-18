"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuppliesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/stock");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen text-muted-foreground">
      Redirigiendo a Inventario...
    </div>
  );
}
