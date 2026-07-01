"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";

interface BackButtonProps {
  /** Where to navigate when there is no browser history to pop. */
  fallbackHref?: string;
  /** Optional visible label; when omitted the button renders icon-only. */
  label?: string;
  className?: string;
}

/**
 * Single source of truth for "go back" navigation.
 *
 * It is meant to live in the header (the menu) via `AdminLayout`'s
 * `leftActions`, never inside a card, so a screen never shows two back
 * controls. It also registers a global keyboard shortcut — Cmd+← on macOS,
 * Ctrl+← on Windows/Linux — to navigate back without the mouse. The shortcut
 * is ignored while the user is typing in a field so it never hijacks caret
 * movement.
 */
export function BackButton({ fallbackHref, label, className }: BackButtonProps) {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    if (fallbackHref) {
      router.push(fallbackHref);
      return;
    }
    router.back();
  }, [router, fallbackHref]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isBackCombo = (event.metaKey || event.ctrlKey) && event.key === "ArrowLeft";
      if (!isBackCombo) return;

      // Never steal the shortcut while the user is editing text.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      event.preventDefault();
      goBack();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack]);

  if (label) {
    return (
      <Button
        variant="ghost"
        onClick={goBack}
        aria-label="Volver"
        className={className ?? "-ml-2 px-2"}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {label}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={goBack}
      aria-label="Volver"
      className={className ?? "flex h-10 w-10 items-center justify-center rounded-full"}
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
