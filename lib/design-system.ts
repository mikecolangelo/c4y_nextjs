/**
 * Design System - Configuración Centralizada
 * 
 * Tokens de diseño reutilizables para mantener consistencia en toda la aplicación.
 * 
 * Para la documentación completa y guía de uso, consulta la regla:
 * `.cursor/rules/design-system.mdc`
 */

// ============================================================================
// COLORES
// ============================================================================

export const colors = {
  // Color primario (amarillo/dorado elegante)
  primary: "oklch(0.73 0.13 75)",
  
  // Colores de inventario (usados en gráficos)
  inventory: {
    nuevos: "oklch(0.73 0.13 75)",      // Amarillo/dorado
    usados: "oklch(0.7 0.15 50)",      // Naranja/amarillo oscuro
    taller: "oklch(0.85 0.1 75)",      // Amarillo claro
  },
  
  // Colores de estado
  success: "oklch(0.6 0.15 150)",      // Verde
  warning: "oklch(0.85 0.1 75)",       // Amarillo
  error: "oklch(0.577 0.245 27.325)",  // Rojo
} as const;

// ============================================================================
// TIPOGRAFÍA
// ============================================================================

export const typography = {
  // Títulos
  h1: "text-[32px] font-bold tracking-tight",
  h2: "text-2xl font-bold tracking-tight",
  h3: "text-lg font-bold",
  h4: "text-base font-semibold",
  
  // Texto de cuerpo
  body: {
    large: "text-base font-medium",
    base: "text-sm font-medium",
    small: "text-sm text-muted-foreground",
  },
  
  // Métricas y números grandes
  metric: {
    large: "text-[32px] font-bold tracking-tight",
    base: "text-2xl font-bold tracking-tight",
  },
  
  // Labels y etiquetas
  label: "text-sm font-medium text-muted-foreground",
} as const;

// ============================================================================
// ESPACIADO
// ============================================================================

export const spacing = {
  // Padding de contenedores principales
  container: {
    horizontal: "px-6",
    vertical: "py-6",
    both: "px-6 py-6",
  },
  
  // Padding de cards
  card: {
    padding: "p-6",
    header: "px-6 pt-6 pb-4",
    content: "px-6 pb-6",
  },
  
  // Gaps entre elementos
  gap: {
    small: "gap-2",    // 8px
    base: "gap-3",     // 12px
    medium: "gap-4",   // 16px
    large: "gap-5",     // 20px
    xlarge: "gap-6",   // 24px
  },
  
  // Header
  header: {
    height: "h-16",
    padding: "px-6",
  },
} as const;

// ============================================================================
// COMPONENTES
// ============================================================================

export const components = {
  // Cards
  card: "shadow-sm ring-1 ring-inset ring-border/50",
  
  // Botones de período/filtro
  periodButton: {
    base: "h-9 shrink-0 rounded-full px-4",
    active: "bg-primary text-primary-foreground",
    inactive: "bg-card",
    text: "text-sm font-semibold",
  },
  
  // Botones de navegación
  navButton: {
    base: "h-10 gap-2 px-4",
    variant: "ghost" as const,
  },
  
  // Badge de inventario
  inventoryBadge: "size-2.5 rounded-full p-0 border-0",
  
  // Botones estándar (todos redondeados)
  button: {
    base: "rounded-lg",
    full: "rounded-full",
  },
  
  // Inputs estándar (todos redondeados)
  input: {
    base: "rounded-lg",
    full: "rounded-xl",
  },
} as const;

// ============================================================================
// LAYOUT
// ============================================================================

export const layout = {
  // Contenedor principal
  main: "flex flex-col gap-6 px-6 py-6 max-w-7xl mx-auto w-full",
  
  // Grid de métricas
  metricsGrid: "grid grid-cols-2 gap-5",
  
  // Header sticky
  header: "sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm",
} as const;

// ============================================================================
// CLASES COMUNES (Combinaciones frecuentes)
// ============================================================================

export const commonClasses = {
  // Títulos
  sectionTitle: typography.h4,
  
  // Métricas
  metricLabel: typography.label,
  metricValue: typography.metric.base,
  
  // Texto
  description: typography.body.small,
  
  // Cards
  card: components.card,
  
  // Contenedores
  mainContainer: layout.main,
} as const;
