"use client";

import { Card, CardContent, CardHeader } from "@/components_shadcn/ui/card";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { spacing } from "@/lib/design-system";

export function VehicleLoadingSkeleton() {
  return (
    <section className={`flex flex-col ${spacing.gap.large}`}>
      {/* Skeleton del Card del Header */}
      <Card 
        className="!bg-transparent shadow-sm backdrop-blur-sm border rounded-lg"
        style={{
          backgroundColor: 'color-mix(in oklch, var(--background) 50%, transparent)',
          borderColor: 'color-mix(in oklch, var(--border) 85%, transparent)',
        } as React.CSSProperties}
      >
        <CardContent className={`flex flex-col items-center ${spacing.gap.base} px-12 relative`}>
          <div className="absolute top-4 right-8 flex items-center justify-end z-10">
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>

          <Skeleton className="w-full h-96 mt-20 rounded-lg" />

          <div className="flex flex-col items-center text-center">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          <div className={`flex items-center justify-center ${spacing.gap.small} w-full pt-2`}>
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </CardContent>
      </Card>

      {/* Skeleton del Card de Información del Vehículo */}
      <Card 
        className="shadow-sm backdrop-blur-sm border rounded-lg"
        style={{
          backgroundColor: 'color-mix(in oklch, var(--background) 50%, transparent)',
          borderColor: 'color-mix(in oklch, var(--border) 85%, transparent)',
        } as React.CSSProperties}
      >
        <CardHeader className="px-6 pt-6 pb-4">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(8)].map((_, index) => (
              <div key={index} className={`flex items-center ${spacing.gap.medium}`}>
                <Skeleton className="h-5 w-5 shrink-0 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Skeleton del Card de Notas y Comentarios */}
      <Card 
        className="shadow-sm backdrop-blur-sm border rounded-lg"
        style={{
          backgroundColor: 'color-mix(in oklch, var(--background) 50%, transparent)',
          borderColor: 'color-mix(in oklch, var(--border) 85%, transparent)',
        } as React.CSSProperties}
      >
        <CardHeader className="px-6 pt-6 pb-4">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
          <ScrollAreaPrimitive.Root className="relative h-[400px] overflow-hidden">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
              <div className={`flex flex-col ${spacing.gap.base} py-2`}>
                {[...Array(3)].map((_, index) => (
                  <div key={index} className={`flex items-start ${spacing.gap.medium}`}>
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.ScrollAreaScrollbar
              orientation="vertical"
              className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
            >
              <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
            </ScrollAreaPrimitive.ScrollAreaScrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>

          <div className={`flex flex-col ${spacing.gap.small} pt-4 border-t border-border`}>
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Skeleton del Card de Estados del Vehículo */}
      <Card 
        className="shadow-sm backdrop-blur-sm border rounded-lg"
        style={{
          backgroundColor: 'color-mix(in oklch, var(--background) 50%, transparent)',
          borderColor: 'color-mix(in oklch, var(--border) 85%, transparent)',
        } as React.CSSProperties}
      >
        <CardHeader className="px-6 pt-6 pb-4">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
          <ScrollAreaPrimitive.Root className="relative h-[900px] overflow-hidden">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
              <div className={`flex flex-col ${spacing.gap.base} py-2`}>
                {[...Array(2)].map((_, index) => (
                  <div key={index} className={`flex items-start ${spacing.gap.medium}`}>
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-48 w-full rounded-lg mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.ScrollAreaScrollbar
              orientation="vertical"
              className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
            >
              <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
            </ScrollAreaPrimitive.ScrollAreaScrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>

          <div className={`flex flex-col ${spacing.gap.small} pt-4 border-t border-border`}>
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

