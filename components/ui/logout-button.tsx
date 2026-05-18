"use client";

import { Button } from "@/components_shadcn/ui/button";
import { actions } from "@/actions";
import { LogOut } from "lucide-react";
import { clearThemeCookie } from "@/lib/theme-provider";

export function LogoutButton() {
  const handleLogout = async () => {
    // Limpiar la cookie del tema en el cliente también
    clearThemeCookie();
    await actions.auth.logoutAction();
  };

  return (
    <Button
      onClick={handleLogout}
      variant="ghost"
      size="sm"
      className="flex items-center gap-2 h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Cerrar sesión</span>
    </Button>
  );
}




