"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components_shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components_shadcn/ui/card";
import { Wrench, ArrowRight } from "lucide-react";
import Link from "next/link";

// Estilos de fallback inline por si el CSS global no carga
const fallbackStyles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "16px",
    backgroundColor: "#f3f4f6", // gray-100
  } as const,
  card: {
    width: "100%",
    maxWidth: "28rem",
    padding: "32px",
    backgroundColor: "#ffffff",
    borderRadius: "0.75rem",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  } as const,
  header: {
    textAlign: "center" as const,
    marginBottom: "24px",
  },
  iconContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "16px",
  },
  iconWrapper: {
    padding: "16px",
    borderRadius: "9999px",
    backgroundColor: "rgba(234, 179, 8, 0.1)", // primary/10
  },
  title: {
    fontSize: "1.875rem",
    fontWeight: "700",
    color: "#eab308", // primary
    marginBottom: "8px",
  },
  description: {
    fontSize: "1rem",
    color: "#6b7280", // gray-500
  },
  content: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    alignItems: "center",
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#000000",
    color: "#ffffff",
    borderRadius: "0.5rem",
    textDecoration: "none",
    fontWeight: "600",
  },
  footer: {
    fontSize: "0.875rem",
    color: "#9ca3af", // gray-400
    textAlign: "center" as const,
  },
};

export function MaintenancePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Estilos inline de fallback */}
      <style>{`
        .maintenance-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 16px;
          background-color: #f3f4f6;
        }
        .maintenance-fallback-card {
          width: 100%;
          max-width: 28rem;
          padding: 32px;
          background-color: #ffffff;
          border-radius: 0.75rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .maintenance-fallback-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .maintenance-fallback-icon {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }
        .maintenance-fallback-icon-inner {
          padding: 16px;
          border-radius: 9999px;
          background-color: rgba(234, 179, 8, 0.1);
        }
        .maintenance-fallback-title {
          font-size: 1.875rem;
          font-weight: 700;
          color: #ca8a04;
          margin-bottom: 8px;
        }
        .maintenance-fallback-desc {
          font-size: 1rem;
          color: #6b7280;
        }
        .maintenance-fallback-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }
        .maintenance-fallback-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background-color: #000000;
          color: #ffffff;
          border-radius: 0.5rem;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.2s;
        }
        .maintenance-fallback-button:hover {
          background-color: #374151;
          transform: scale(1.02);
        }
        .maintenance-fallback-footer {
          font-size: 0.875rem;
          color: #9ca3af;
          text-align: center;
        }
      `}</style>

      {/* Contenedor con clases de Tailwind + fallback */}
      <div
        className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4 maintenance-fallback"
        style={fallbackStyles.container}
      >
        <Card
          className="w-full max-w-md py-8 px-8 bg-card maintenance-fallback-card"
          style={fallbackStyles.card}
        >
          <CardHeader
            className="space-y-4 pb-6 text-center maintenance-fallback-header"
            style={fallbackStyles.header}
          >
            <div
              className="flex justify-center maintenance-fallback-icon"
              style={fallbackStyles.iconContainer}
            >
              <div
                className="rounded-full bg-primary/10 p-4 maintenance-fallback-icon-inner"
                style={fallbackStyles.iconWrapper}
              >
                {mounted ? (
                  <Wrench className="h-12 w-12 text-primary animate-pulse" />
                ) : (
                  <div className="h-12 w-12" aria-hidden="true" />
                )}
              </div>
            </div>
            <CardTitle
              className="text-3xl font-bold text-primary maintenance-fallback-title"
              style={fallbackStyles.title}
            >
              Under Maintenance
            </CardTitle>
            <CardDescription
              className="text-base maintenance-fallback-desc"
              style={fallbackStyles.description}
            >
              We&apos;re working on something amazing. The website will be available soon.
            </CardDescription>
          </CardHeader>
          <CardContent
            className="space-y-4 maintenance-fallback-content"
            style={fallbackStyles.content}
          >
            <div className="flex justify-center">
              <Button asChild variant="default" className="btn-black flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="maintenance-fallback-button"
                  style={fallbackStyles.button}
                >
                  Dashboard
                  {mounted ? (
                    <ArrowRight className="h-4 w-4" />
                  ) : (
                    <span className="h-4 w-4" aria-hidden="true" />
                  )}
                </Link>
              </Button>
            </div>
            <p
              className="text-sm text-muted-foreground text-center maintenance-fallback-footer"
              style={fallbackStyles.footer}
            >
              Thank you for your patience!
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
