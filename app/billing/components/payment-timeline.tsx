"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, subWeeks, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar,
  Banknote,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Play,
  Loader2,
  Trash2,
  CreditCard,
  Link2,
  Unlink,
  FolderTree,
  GripVertical
} from "lucide-react";
// DnD Kit imports
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  useDraggable,
  useDroppable,
  defaultDropAnimation,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Separator } from "@/components_shadcn/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components_shadcn/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components_shadcn/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components_shadcn/ui/dialog";
import { typography, spacing, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { PaymentExport } from "./payment-export";

export type PeriodFilter = "all" | "week" | "biweekly" | "month" | "semester" | "year" | "custom";

export type PaymentStatus = "pagado" | "pendiente" | "adelanto" | "retrasado" | "abonado" | "cubierta";

// Tipo extendido para filtros que incluye "multa" (pagos con amount < 0)
export type PaymentStatusFilter = PaymentStatus | "multa" | "all";

export interface PaymentRecord {
  id: string | number;
  documentId?: string;
  invoiceNumber: string;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  paymentDate?: string;
  quotaNumber?: number;
  lateFeeAmount?: number;
  daysLate?: number;
  currency?: string;
  createdAt?: string;
  quotasCovered?: number;
  quotaAmountCovered?: number;
  advanceCredit?: number;
  remainingQuotaBalance?: number;
  advanceForQuota?: number;
  partialQuotaStart?: number;
  partialQuotaEnd?: number;
  quotaTotalAmount?: number;
  paidAmount?: number;
  balanceDue?: number;
  availableAmount?: number; // Saldo disponible para adelantos
  clientId?: string;
  clientDocumentId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  vehicleName?: string;
  vehiclePlate?: string;
  parentId?: string;
  parentReceiptNumber?: string;
  children?: PaymentRecord[];
}

interface PaymentTimelineProps {
  payments: PaymentRecord[];
  financingNumber?: string;
  vehicleName?: string;
  clientName?: string;
  totalAmount?: number;
  currentBalance?: number;
  maxHeight?: string;
  showSummary?: boolean;
  showFilters?: boolean;
  title?: string;
  onPaymentClick?: (payment: PaymentRecord) => void;
  className?: string;
  isLoading?: boolean;
  isTestModeEnabled?: boolean;
  userRole?: string;
  onSimulateTuesday?: () => Promise<void>;
  onSimulateFriday?: () => Promise<void>;
  financingId?: string;
  currentWeek?: number;
  onWeekChange?: (week: number) => void;
  onDeletePayment?: (payment: PaymentRecord) => void;
  onPayPending?: (payment: PaymentRecord, paymentData: { paymentDate: string; confirmationNumber?: string; notes?: string }) => Promise<void>;
  partialPaymentCredit?: number;
  quotaAmount?: number;
  paymentFrequency?: "semanal" | "quincenal" | "mensual";
  paidQuotas?: number;
  totalQuotas?: number;
  onAssociateToParent?: (paymentId: string, parentId: string) => Promise<void>;
  onDisassociateFromParent?: (paymentId: string) => Promise<void>;
  availableParents?: { id: string; receiptNumber: string; amount: number; paymentDate?: string }[];
}

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "week", label: "Esta semana" },
  { value: "biweekly", label: "Últimos 15 días" },
  { value: "month", label: "Este mes" },
  { value: "semester", label: "Últimos 6 meses" },
  { value: "year", label: "Este año" },
  { value: "custom", label: "Personalizado" },
];

const statusConfig: Record<PaymentStatus, {
  label: string;
  icon: typeof CheckCircle2;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  pagado: {
    label: "Pagado",
    icon: CheckCircle2,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
    dotColor: "bg-green-500",
  },
  pendiente: {
    label: "Pendiente",
    icon: Clock,
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    textColor: "text-yellow-700 dark:text-yellow-400",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    dotColor: "bg-yellow-500",
  },
  adelanto: {
    label: "Adelanto",
    icon: Banknote,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  retrasado: {
    label: "Retrasado",
    icon: AlertCircle,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
    dotColor: "bg-red-500",
  },
  abonado: {
    label: "Abonado",
    icon: Banknote,
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    textColor: "text-purple-700 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
    dotColor: "bg-purple-500",
  },
  cubierta: {
    label: "Cubierta",
    icon: CheckCircle2,
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    textColor: "text-emerald-700 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
  },
};

const multaConfig = {
  label: "Multa",
  icon: AlertCircle,
  bgColor: "bg-orange-50 dark:bg-orange-950/30",
  textColor: "text-orange-700 dark:text-orange-400",
  borderColor: "border-orange-200 dark:border-orange-800",
  dotColor: "bg-orange-500",
};

// ============================================================================
// COMPONENTES DnD SEPARADOS (para seguir las reglas de hooks de React)
// ============================================================================

interface DraggableChildItemProps {
  child: PaymentRecord;
  onPaymentClick?: (payment: PaymentRecord) => void;
  onDisassociateFromParent?: (paymentId: string) => Promise<void>;
  onDisassociate?: (payment: PaymentRecord) => void; // Nueva prop para desasociación asíncrona
  onDeletePayment?: (payment: PaymentRecord) => void | Promise<void>;
  getShortIdentifier: (payment: PaymentRecord) => string;
  formatCurrency: (value: number, currency?: string) => string;
  formatDate: (dateString: string) => string;
}

// Componente para un hijo draggable
function DraggableChildItem({ 
  child, 
  onPaymentClick, 
  onDisassociateFromParent, 
  onDisassociate,
  onDeletePayment,
  getShortIdentifier,
  formatCurrency,
  formatDate,
}: DraggableChildItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(child.id),
    data: { type: 'payment', payment: child },
  });

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
    willChange: 'transform',
  } : undefined;

  const isChildMulta = child.amount < 0;
  const childConfig = isChildMulta ? multaConfig : statusConfig[child.status];
  const ChildStatusIcon = childConfig.icon;
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    // Esperar la animación antes de eliminar
    setTimeout(() => {
      onDeletePayment?.(child);
    }, 300);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative pl-6 cursor-pointer group animate-in fade-in slide-in-from-left-4 duration-300",
        isDeleting && "animate-out fade-out slide-out-to-right-4 duration-300",
        onPaymentClick && "hover:opacity-80 transition-opacity",
        isDragging && "opacity-50"
      )}
      onClick={() => onPaymentClick?.(child)}
    >
      {/* Dot para hijo */}
      <div className={cn(
        "absolute left-0 top-1 h-4 w-4 rounded-full flex items-center justify-center z-10",
        childConfig.bgColor,
        "border",
        childConfig.borderColor
      )}>
        <ChildStatusIcon className={cn("h-2 w-2", childConfig.textColor)} />
      </div>
      
      {/* Card del hijo - ahora toda la tarjeta es draggable */}
      <div 
        {...attributes}
        {...listeners}
        className={cn(
          "rounded-lg p-2 border transition-all cursor-grab active:cursor-grabbing",
          childConfig.bgColor,
          childConfig.borderColor,
          "group-hover:shadow-sm"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Indicador visual de drag */}
              <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium">
                {getShortIdentifier(child)}
              </span>
              {child.quotaNumber && (
                <Badge variant="outline" className="text-[10px]">
                  Cuota #{child.quotaNumber}
                </Badge>
              )}
              <Badge className={cn(
                "text-[10px]",
                childConfig.bgColor,
                childConfig.textColor,
                "border",
                childConfig.borderColor
              )}>
                {isChildMulta ? "Multa" : childConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              {child.paymentDate && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-2 w-2 text-green-500" />
                  {formatDate(child.paymentDate)}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
            <div className="text-right">
              <p className="text-sm font-medium">
                {formatCurrency(child.amount, child.currency)}
              </p>
            </div>
            
            {/* Botón desasociar para hijos */}
            {(onDisassociate || onDisassociateFromParent) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Usar nueva función asíncrona si está disponible
                  if (onDisassociate) {
                    onDisassociate(child);
                  } else if (onDisassociateFromParent) {
                    onDisassociateFromParent(String(child.id));
                  }
                }}
                className="p-1 hover:bg-orange-100 rounded-full text-orange-500 transition-colors cursor-pointer"
                title="Desasociar de recibo padre"
              >
                <Unlink className="h-3 w-3" />
              </button>
            )}
            
            {/* Botón eliminar para hijos */}
            {onDeletePayment && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1 hover:bg-red-100 rounded-full text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                title="Eliminar"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DroppableParentItemProps {
  payment: PaymentRecord & { totalCobro?: number };
  isOver: boolean;
  activeDragId: string | number | null;
  children: React.ReactNode;
}

// Componente para un padre droppable
function DroppableParentItem({ payment, isOver, activeDragId, children }: DroppableParentItemProps) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({
    id: String(payment.id),
    data: { type: 'parent', payment },
    disabled: String(activeDragId) === String(payment.id), // No permitir drop sobre sí mismo
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative min-w-0",
        (isOver || dndIsOver) && "ring-2 ring-blue-400 ring-inset rounded-lg bg-blue-50/30"
      )}
    >
      {children}
    </div>
  );
}

interface DraggableRootItemProps {
  payment: PaymentRecord & { totalCobro?: number };
  canDrag: boolean;
  isOver: boolean;
  activeDragId: string | number | null;
  children: React.ReactNode;
}

// Componente para un ítem raíz que puede ser draggable y/o droppable
function DraggableRootItem({ payment, canDrag, isOver, activeDragId, children }: DraggableRootItemProps) {
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: String(payment.id),
    data: { type: 'payment', payment },
    disabled: !canDrag,
  });

  const { setNodeRef: setDroppableRef, isOver: dndIsOver } = useDroppable({
    id: String(payment.id),
    data: { type: 'parent', payment },
    disabled: String(activeDragId) === String(payment.id),
  });

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    willChange: 'transform',
  } : undefined;

  // Combinar refs
  const setRefs = (el: HTMLElement | null) => {
    setDraggableRef(el);
    setDroppableRef(el);
  };

  return (
    <div
      ref={setRefs}
      style={style}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={cn(
        "relative",
        canDrag && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
        (isOver || dndIsOver) && "ring-2 ring-blue-400 ring-inset rounded-lg bg-blue-50/30"
      )}
    >
      {canDrag && (
        <div className="absolute -left-1 top-1 z-20 md:left-0 pointer-events-none">
          <div className="p-1.5 md:p-1 text-gray-400">
            <GripVertical className="h-5 w-5 md:h-4 md:w-4" />
          </div>
        </div>
      )}
      <div className={cn("pl-7 md:pl-8", canDrag && "pl-9 md:pl-8")}>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function PaymentTimeline({
  payments,
  maxHeight = "400px",
  showSummary = true,
  showFilters = true,
  title = "Timeline de Pagos",
  onPaymentClick,
  className,
  isLoading = false,
  isTestModeEnabled = false,
  userRole = "",
  onSimulateTuesday,
  onSimulateFriday,
  financingId,
  currentWeek = 1,
  onWeekChange,
  onDeletePayment,
  onPayPending,
  partialPaymentCredit = 0,
  quotaAmount,
  paymentFrequency = "semanal",
  paidQuotas = 0,
  totalQuotas = 0,
  financingNumber,
  vehicleName,
  clientName,
  totalAmount,
  currentBalance,
  onAssociateToParent,
  onDisassociateFromParent,
  availableParents = [],
}: PaymentTimelineProps) {
  // Estado local de pagos para actualizaciones optimistas (sin recargar)
  const [localPayments, setLocalPayments] = useState<PaymentRecord[]>(payments);
  
  // Sincronizar con props cuando cambien externamente
  useEffect(() => {
    setLocalPayments(payments);
  }, [payments]);
  
  // Estado de filtros
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<PaymentStatusFilter[]>([]);
  const [expandedAbonos, setExpandedAbonos] = useState<Set<string | number>>(new Set());
  const [selectedAbono, setSelectedAbono] = useState<PaymentRecord | null>(null);
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [isPayPendingOpen, setIsPayPendingOpen] = useState(false);
  const [selectedPendingPayment, setSelectedPendingPayment] = useState<PaymentRecord | null>(null);
  const [pendingPaymentData, setPendingPaymentData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    confirmationNumber: '',
    notes: '',
  });
  const [isPaying, setIsPaying] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string | number>>(new Set());
  
  // Actualizar expandedParents cuando localPayments cambia
  useEffect(() => {
    const parentIds = localPayments
      .filter(p => p.children && p.children.length > 0)
      .map(p => p.id);
    setExpandedParents(new Set(parentIds));
  }, [localPayments]);
  const [isAssociateModalOpen, setIsAssociateModalOpen] = useState(false);
  const [selectedPaymentForAssociate, setSelectedPaymentForAssociate] = useState<PaymentRecord | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  // Estado para operaciones en progreso (solo visual, no bloquea UI)
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // DnD Estados
  const [activeDragId, setActiveDragId] = useState<string | number | null>(null);
  const [overId, setOverId] = useState<string | number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );
  
  const dropAnimation: DropAnimation = {
    duration: 200,
    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.3' } },
    }),
  };
  
  const [isSimulatingTuesday, setIsSimulatingTuesday] = useState(false);
  const [isSimulatingFriday, setIsSimulatingFriday] = useState(false);
  const showSimulationControls = isTestModeEnabled && userRole === "admin" && financingId;
  
  // Funciones helper memoizadas
  const formatCurrency = useCallback((value: number, currency = "PAB") => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    try {
      return format(new Date(dateString), "d MMM yyyy", { locale: es });
    } catch {
      return dateString;
    }
  }, []);

  const getShortIdentifier = useCallback((payment: PaymentRecord): string => {
    if (payment.invoiceNumber?.startsWith("SIM-")) {
      const parts = payment.invoiceNumber.split("-");
      if (parts.length >= 4) {
        return `SIM-${parts[1]}-#${parts[parts.length - 1]}`;
      }
    }
    if (payment.invoiceNumber && payment.invoiceNumber.length > 25) {
      return payment.invoiceNumber.substring(0, 22) + "...";
    }
    return payment.invoiceNumber || `Cuota #${payment.quotaNumber || "?"}`;
  }, []);

  const toggleAbonoDetail = (paymentId: string | number) => {
    setExpandedAbonos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) newSet.delete(paymentId);
      else newSet.add(paymentId);
      return newSet;
    });
  };
  
  const openAbonoDetail = (payment: PaymentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedAbono(payment);
    setIsAbonoModalOpen(true);
  };
  
  const closeAbonoDetail = () => {
    setIsAbonoModalOpen(false);
    setSelectedAbono(null);
  };
  
  const openPayPendingModal = (payment: PaymentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPendingPayment(payment);
    setPendingPaymentData({
      paymentDate: new Date().toISOString().split('T')[0],
      confirmationNumber: '',
      notes: '',
    });
    setIsPayPendingOpen(true);
  };
  
  const closePayPendingModal = () => {
    setIsPayPendingOpen(false);
    setSelectedPendingPayment(null);
    setPendingPaymentData({
      paymentDate: new Date().toISOString().split('T')[0],
      confirmationNumber: '',
      notes: '',
    });
  };
  
  const handlePayPending = async () => {
    if (!selectedPendingPayment || !onPayPending) return;
    setIsPaying(true);
    try {
      await onPayPending(selectedPendingPayment, pendingPaymentData);
      closePayPendingModal();
    } catch (error) {
      console.error('Error al pagar:', error);
    } finally {
      setIsPaying(false);
    }
  };
  
  // DnD Handlers
  const findPaymentById = useCallback((id: string | number): (PaymentRecord & { totalCobro?: number }) | null => {
    const idStr = String(id);
    for (const node of paymentTree) {
      if (String(node.id) === idStr) return node;
      if (node.children) {
        const child = node.children.find(c => String(c.id) === idStr);
        if (child) return child as PaymentRecord & { totalCobro?: number };
      }
    }
    return null;
  }, [localPayments]);
  
  const canDragPayment = useCallback((payment: PaymentRecord): boolean => {
    if (payment.children && payment.children.length > 0) return false;
    const isParentInTree = paymentTree.some(p => p.id === payment.id && p.children && p.children.length > 0);
    if (isParentInTree) return false;
    return true;
  }, [localPayments]);
  
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id);
    setIsDragging(true);
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id : null);
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setOverId(null);
    setIsDragging(false);
    
    if (!over) return;
    
    const draggedId = active.id;
    const dropTargetId = over.id;
    
    if (String(draggedId) === String(dropTargetId)) return;
    
    const draggedPayment = findPaymentById(draggedId);
    if (!draggedPayment) return;
    
    // Guardar estado anterior para posible rollback
    const previousPayments = [...localPayments];
    
    // Caso 1: Soltar en zona desasociada
    if (String(dropTargetId) === 'unassigned-zone') {
      if (draggedPayment.parentId && onDisassociateFromParent) {
        // Actualización optimista: mover a raíz inmediatamente
        setLocalPayments(prev => prev.map(p => {
          if (p.id === draggedId) {
            return { ...p, parentId: undefined };
          }
          // Remover de children del padre anterior
          if (p.children) {
            return { ...p, children: p.children.filter(c => String(c.id) !== String(draggedId)) };
          }
          return p;
        }));
        
        try {
          await onDisassociateFromParent(String(draggedId));
        } catch (error) {
          console.error('Error al desasociar:', error);
          // Revertir cambio local si falla
          setLocalPayments(previousPayments);
        }
      }
      return;
    }
    
    // Caso 2: Soltar sobre un padre
    const targetPayment = findPaymentById(dropTargetId);
    if (!targetPayment) return;
    
    const isTargetParent = paymentTree.some(p => String(p.id) === String(dropTargetId));
    const canDropOnTarget = isTargetParent && String(draggedId) !== String(dropTargetId);
    
    if (canDropOnTarget && onAssociateToParent) {
      const previousParentId = draggedPayment.parentId;
      
      // Actualización optimista: asociar al nuevo padre inmediatamente
      setLocalPayments(prev => prev.map(p => {
        // Remover de padre anterior si existe
        if (previousParentId && p.id === previousParentId && p.children) {
          return { ...p, children: p.children.filter(c => String(c.id) !== String(draggedId)) };
        }
        // Agregar al nuevo padre
        if (String(p.id) === String(dropTargetId)) {
          const updatedChildren = [...(p.children || []), { ...draggedPayment, parentId: String(dropTargetId) }];
          return { ...p, children: updatedChildren };
        }
        // Actualizar el propio payment
        if (String(p.id) === String(draggedId)) {
          return { ...p, parentId: String(dropTargetId) };
        }
        return p;
      }));
      
      try {
        if (previousParentId && onDisassociateFromParent) {
          await onDisassociateFromParent(String(draggedId));
        }
        await onAssociateToParent(String(draggedId), String(dropTargetId));
      } catch (error) {
        console.error('Error al reasociar:', error);
        // Revertir cambio local si falla
        setLocalPayments(previousPayments);
      }
    }
  };
  
  const toggleParentExpand = (parentId: string | number) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) newSet.delete(parentId);
      else newSet.add(parentId);
      return newSet;
    });
  };
  
  const expandAllParents = () => {
    const allParentIds = localPayments
      .filter(p => p.children && p.children.length > 0)
      .map(p => p.id);
    setExpandedParents(new Set(allParentIds));
  };
  
  const collapseAllParents = () => {
    setExpandedParents(new Set());
  };
  
  const openAssociateModal = (payment: PaymentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPaymentForAssociate(payment);
    setSelectedParentId("");
    setIsAssociateModalOpen(true);
  };
  
  const closeAssociateModal = () => {
    setIsAssociateModalOpen(false);
    setSelectedPaymentForAssociate(null);
    setSelectedParentId("");
  };
  
  const handleAssociate = () => {
    if (!selectedPaymentForAssociate || !selectedParentId || !onAssociateToParent) return;
    
    const paymentId = String(selectedPaymentForAssociate.id);
    const parentId = selectedParentId;
    const previousPayments = [...localPayments];
    
    // Actualización optimista inmediata - cerrar modal sin esperar
    setLocalPayments(prev => prev.map(p => {
      // Agregar al nuevo padre
      if (String(p.id) === parentId) {
        const updatedChildren = [...(p.children || []), { 
          ...selectedPaymentForAssociate, 
          parentId: parentId 
        }];
        return { ...p, children: updatedChildren };
      }
      // Actualizar el payment movido
      if (String(p.id) === paymentId) {
        return { ...p, parentId: parentId };
      }
      return p;
    }));
    
    // Cerrar modal inmediatamente (no bloquear UI)
    closeAssociateModal();
    
    // Llamar API en background sin await
    onAssociateToParent(paymentId, parentId).catch(error => {
      console.error('Error al asociar:', error);
      // Revertir cambio local si falla
      setLocalPayments(previousPayments);
    });
  };
  
  const handleDisassociate = (payment: PaymentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onDisassociateFromParent) return;
    
    const paymentId = String(payment.id);
    const previousParentId = payment.parentId;
    const previousPayments = [...localPayments];
    
    // Actualización optimista inmediata
    setLocalPayments(prev => prev.map(p => {
      if (String(p.id) === paymentId) {
        return { ...p, parentId: undefined };
      }
      // Remover de children del padre anterior
      if (previousParentId && String(p.id) === previousParentId && p.children) {
        return { ...p, children: p.children.filter(c => String(c.id) !== paymentId) };
      }
      return p;
    }));
    
    // Llamar API en background sin await
    onDisassociateFromParent(paymentId).catch(error => {
      console.error('Error al desasociar:', error);
      // Revertir cambio local si falla
      setLocalPayments(previousPayments);
    });
  };
  
  // Wrapper para desasociar hijos desde el componente DraggableChildItem
  const handleChildDisassociate = (child: PaymentRecord) => {
    if (!onDisassociateFromParent) return;
    
    const paymentId = String(child.id);
    const previousParentId = child.parentId;
    const previousPayments = [...localPayments];
    
    // Actualización optimista inmediata
    setLocalPayments(prev => prev.map(p => {
      if (String(p.id) === paymentId) {
        return { ...p, parentId: undefined };
      }
      // Remover de children del padre anterior
      if (previousParentId && String(p.id) === previousParentId && p.children) {
        return { ...p, children: p.children.filter(c => String(c.id) !== paymentId) };
      }
      return p;
    }));
    
    // Llamar API en background sin await
    onDisassociateFromParent(paymentId).catch(error => {
      console.error('Error al desasociar hijo:', error);
      // Revertir cambio local si falla
      setLocalPayments(previousPayments);
    });
  };
  
  // Wrapper para eliminar hijos desde el componente DraggableChildItem
  const handleChildDelete = (child: PaymentRecord) => {
    const paymentId = String(child.id);
    const parentId = child.parentId;
    const previousPayments = [...localPayments];
    
    // Actualización optimista: eliminar el hijo y actualizar el padre
    setLocalPayments(prev => prev.map(p => {
      // Si es el padre, remover el hijo de su lista
      if (parentId && String(p.id) === parentId && p.children) {
        return { ...p, children: p.children.filter(c => String(c.id) !== paymentId) };
      }
      return p;
    }).filter(p => String(p.id) !== paymentId)); // Eliminar el hijo de la lista principal
    
    // Llamar onDeletePayment en background (siempre async)
    if (onDeletePayment) {
      Promise.resolve(onDeletePayment(child)).catch((error) => {
        console.error('Error al eliminar hijo:', error);
        setLocalPayments(previousPayments);
      });
    }
  };
  
  const calculateNextDueDate = useCallback((
    startDate: string,
    quotasCovered: number,
    frequency: "semanal" | "quincenal" | "mensual"
  ): string => {
    try {
      const baseDate = new Date(startDate);
      const nextQuota = quotasCovered + 1;
      
      let daysToAdd = 0;
      switch (frequency) {
        case "semanal":
          daysToAdd = (nextQuota - 1) * 7;
          break;
        case "quincenal":
          daysToAdd = (nextQuota - 1) * 15;
          break;
        case "mensual":
          const result = new Date(baseDate);
          result.setMonth(result.getMonth() + (nextQuota - 1));
          return format(result, "d MMM yyyy", { locale: es });
        default:
          daysToAdd = (nextQuota - 1) * 7;
      }
      
      const resultDate = new Date(baseDate);
      resultDate.setDate(resultDate.getDate() + daysToAdd);
      return format(resultDate, "d MMM yyyy", { locale: es });
    } catch {
      return "-";
    }
  }, []);

  const getDateRange = (period: PeriodFilter): { start: Date; end: Date } | null => {
    const today = new Date();
    switch (period) {
      case "week":
        return { start: startOfWeek(today, { locale: es }), end: endOfWeek(today, { locale: es }) };
      case "biweekly":
        return { start: subDays(today, 15), end: today };
      case "month":
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case "semester":
        return { start: subMonths(today, 6), end: today };
      case "year":
        return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear(), 11, 31) };
      case "custom":
        if (startDate && endDate) {
          return { start: new Date(startDate), end: new Date(endDate) };
        }
        return null;
      default:
        return null;
    }
  };

  const filteredPayments = useMemo(() => {
    let result = localPayments;
    const dateRange = getDateRange(periodFilter);
    if (dateRange) {
      result = result.filter((payment) => {
        const paymentDate = new Date(payment.paymentDate || payment.dueDate);
        return isWithinInterval(paymentDate, { start: dateRange.start, end: dateRange.end });
      });
    }
    if (selectedStatuses.length > 0) {
      result = result.filter((payment) => {
        const isMultaSelected = selectedStatuses.includes("multa");
        const isPaymentMulta = payment.amount < 0;
        if (isPaymentMulta && isMultaSelected) return true;
        if (isPaymentMulta && !isMultaSelected) {
          return selectedStatuses.includes(payment.status);
        }
        return selectedStatuses.includes(payment.status);
      });
    }
    return result;
  }, [localPayments, periodFilter, startDate, endDate, selectedStatuses]);
  
  const paymentTree = useMemo(() => {
    console.log('[DEBUG] ===== CONSTRUYENDO PAYMENT TREE =====');
    console.log('[DEBUG] filteredPayments count:', filteredPayments.length);
    console.log('[DEBUG] Payments recibidos:', filteredPayments.map(p => ({ 
      id: p.id, 
      receipt: p.invoiceNumber?.substring(0, 20), 
      status: p.status,
      parentId: p.parentId,
      hasChildren: p.children && p.children.length > 0,
      childCount: p.children?.length || 0
    })));
    
    const paymentMap = new Map<string | number, PaymentRecord & { totalCobro?: number }>();
    
    // Primera pasada: poblar el mapa con TODOS los pagos
    filteredPayments.forEach(p => {
      paymentMap.set(p.id, { ...p, children: p.children || [] });
    });
    
    const rootNodes: (PaymentRecord & { totalCobro?: number })[] = [];
    const processedChildIds = new Set<string | number>();
    
    // Segunda pasada: procesar relaciones padre-hijo
    // Primero procesar los que tienen parentId (hijos)
    filteredPayments.forEach(payment => {
      if (payment.parentId) {
        const parent = paymentMap.get(payment.parentId);
        if (parent) {
          const paymentWithChildren = paymentMap.get(payment.id)!;
          if (!parent.children) parent.children = [];
          // Evitar duplicar hijos que ya existen
          const alreadyExists = parent.children.some(c => c.id === payment.id);
          if (!alreadyExists) {
            parent.children.push(paymentWithChildren);
          }
          processedChildIds.add(payment.id);
        }
      }
    });
    
    // Tercera pasada: agregar nodos raíz (los que no son hijos de nadie)
    filteredPayments.forEach(payment => {
      if (!payment.parentId || !processedChildIds.has(payment.id)) {
        const paymentWithChildren = paymentMap.get(payment.id)!;
        rootNodes.push(paymentWithChildren);
      }
    });
    
    rootNodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        const childrenTotal = node.children.reduce((sum, child) => sum + (child.amount || 0), 0);
        node.totalCobro = (node.amount || 0) + childrenTotal;
        const linkedPositiveTotal = node.children.reduce(
          (sum, child) => sum + (child.amount > 0 ? child.amount : 0), 
          0
        );
        // Recalcular balanceDue para nodos con hijos
        const baseBalanceDue = node.amount ?? 0;
        node.balanceDue = Math.max(0, baseBalanceDue - linkedPositiveTotal);
      }
      
      // Asegurar consistencia de balance para estados terminales
      if (node.status === 'pagado' || node.status === 'cubierta') {
        node.balanceDue = 0;
      }
      
      // Para nodos pendientes/retrasados/abonados sin hijos, asegurar que balanceDue refleje el monto
      if ((node.status === 'pendiente' || node.status === 'retrasado' || node.status === 'abonado') && 
          (!node.children || node.children.length === 0) && node.balanceDue === undefined) {
        node.balanceDue = node.amount ?? 0;
      }
    });
    
    rootNodes.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.dueDate).getTime();
      const dateB = new Date(b.createdAt || b.dueDate).getTime();
      return dateB - dateA;
    });
    
    rootNodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.dueDate).getTime();
          const dateB = new Date(b.createdAt || b.dueDate).getTime();
          return dateA - dateB;
        });
      }
    });
    
    console.log('[DEBUG] ===== RESULTADO PAYMENT TREE =====');
    console.log('[DEBUG] rootNodes count:', rootNodes.length);
    console.log('[DEBUG] Estructura:', rootNodes.map(n => ({
      id: n.id,
      receipt: n.invoiceNumber?.substring(0, 20),
      childCount: n.children?.length || 0,
      children: n.children?.map(c => ({ id: c.id, receipt: c.invoiceNumber?.substring(0, 20) }))
    })));
    
    return rootNodes;
  }, [filteredPayments]);

  const summary = useMemo(() => {
    const paid = localPayments.filter((p) => p.status === "pagado");
    const pending = localPayments.filter((p) => p.status === "pendiente");
    const advance = localPayments.filter((p) => p.status === "adelanto");
    const overdue = localPayments.filter((p) => p.status === "retrasado");
    const partial = localPayments.filter((p) => p.status === "abonado");
    const multas = localPayments.filter((p) => p.amount < 0);

    return {
      total: localPayments.length,
      paid: paid.length,
      pending: pending.length,
      advance: advance.length,
      overdue: overdue.length,
      partial: partial.length,
      multas: multas.length,
      paidAmount: paid.reduce((sum, p) => sum + p.amount, 0),
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      advanceAmount: advance.reduce((sum, p) => sum + p.amount, 0),
      overdueAmount: overdue.reduce((sum, p) => sum + p.amount + (p.lateFeeAmount || 0), 0),
      partialAmount: partial.reduce((sum, p) => sum + p.amount, 0),
      multasAmount: multas.reduce((sum, p) => sum + p.amount, 0),
      totalCollected: paid.reduce((sum, p) => sum + p.amount, 0) + advance.reduce((sum, p) => sum + p.amount, 0) + partial.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [localPayments]);

  const nextQuotaToPay = useMemo(() => {
    let maxCoveredQuota = 0;
    localPayments.forEach((payment) => {
      if (payment.status === "pagado" && payment.quotaNumber) {
        maxCoveredQuota = Math.max(maxCoveredQuota, payment.quotaNumber);
      } else if ((payment.status === "abonado" || payment.status === "adelanto") && payment.quotaNumber) {
        const quotasCovered = payment.quotasCovered || 1;
        const endQuota = payment.quotaNumber + quotasCovered - 1;
        maxCoveredQuota = Math.max(maxCoveredQuota, endQuota);
      }
    });
    const baseNextQuota = maxCoveredQuota > 0 ? maxCoveredQuota + 1 : (paidQuotas || 0) + 1;
    return totalQuotas > 0 ? Math.min(baseNextQuota, totalQuotas) : baseNextQuota;
  }, [localPayments, paidQuotas, totalQuotas]);

  const isNextQuotaGenerated = useMemo(() => {
    if (nextQuotaToPay <= 0) return false;
    return localPayments.some(p => 
      p.quotaNumber === nextQuotaToPay && 
      (p.status === "pendiente" || p.status === "retrasado")
    );
  }, [localPayments, nextQuotaToPay]);

  const clearFilters = () => {
    setPeriodFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = periodFilter !== "all";
  const parentPaymentsCount = useMemo(() => 
    paymentTree.filter(p => p.children && p.children.length > 0).length,
    [paymentTree]
  );
  
  const toggleStatus = (status: PaymentStatusFilter) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const handleSimulateTuesday = async () => {
    if (!onSimulateTuesday) return;
    setIsSimulatingTuesday(true);
    try {
      await onSimulateTuesday();
    } finally {
      setIsSimulatingTuesday(false);
    }
  };
  
  const handleSimulateFriday = async () => {
    if (!onSimulateFriday) return;
    setIsSimulatingFriday(true);
    try {
      await onSimulateFriday();
    } finally {
      setIsSimulatingFriday(false);
    }
  };

  // Componente interno para renderizar el contenido de un pago padre
  const ParentContent = ({ payment }: { payment: PaymentRecord & { totalCobro?: number } }) => {
    const isMulta = payment.amount < 0;
    const config = isMulta ? multaConfig : statusConfig[payment.status];
    const StatusIcon = config.icon;
    const isDraggable = onAssociateToParent && canDragPayment(payment);
    const isDropTarget = overId === payment.id && activeDragId !== payment.id;

    return (
      <>
        {/* Dot */}
        <div className={cn(
          "absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center z-10",
          config.bgColor,
          "border-2",
          config.borderColor
        )}>
          <StatusIcon className={cn("h-3 w-3", config.textColor)} />
        </div>

        {/* Content Card */}
        <div 
          className={cn(
            "rounded-lg p-3 border transition-all duration-300 animate-in fade-in slide-in-from-left-2",
            config.bgColor,
            config.borderColor,
            "group-hover:shadow-sm hover:scale-[1.01]"
          )}
          onClick={() => onPaymentClick?.(payment)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={typography.body.large} title={payment.invoiceNumber}>
                  {getShortIdentifier(payment)}
                </span>
                {payment.quotasCovered !== undefined && payment.quotasCovered > 1 && payment.quotaNumber ? (
                  <Badge variant="outline" className="text-xs">
                    Cuotas #{payment.quotaNumber}–#{payment.quotaNumber + payment.quotasCovered - 1}
                  </Badge>
                ) : payment.quotaNumber ? (
                  <Badge variant="outline" className="text-xs">
                    Cuota #{payment.quotaNumber}
                  </Badge>
                ) : null}
                <Badge className={cn(
                  "text-xs",
                  isMulta ? multaConfig.bgColor : config.bgColor,
                  isMulta ? multaConfig.textColor : config.textColor,
                  "border",
                  isMulta ? multaConfig.borderColor : config.borderColor
                )}>
                  {isMulta ? "Multa" : config.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {payment.status !== "adelanto" && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Vence: {formatDate(payment.dueDate)}
                  </span>
                )}
                {payment.paymentDate && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Pagado: {formatDate(payment.paymentDate)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                {/* Calcular total a pagar (pendiente + penalidad) */}
                {(() => {
                  const pendingBalance = payment.balanceDue !== undefined 
                    ? payment.balanceDue 
                    : payment.amount;
                  const lateFee = payment.lateFeeAmount || 0;
                  const totalToPay = pendingBalance + lateFee;
                  
                  // DEBUG
                  console.log(`[DEBUG timeline] ${payment.invoiceNumber}: amount=${payment.amount}, balanceDue=${payment.balanceDue}, lateFee=${lateFee}, totalToPay=${totalToPay}`);
                  
                  return (
                    <>
                      {payment.children && payment.children.length > 0 ? (
                        <div>
                          {/* Mostrar saldo disponible para adelantos */}
                          {payment.status === 'adelanto' ? (
                            /* Adelanto: mostrar disponible y consumido */
                            (() => {
                              const consumedAmount = payment.children?.reduce((sum, child) => sum + (child.amount || 0), 0) || 0;
                              // Calcular disponible: si availableAmount viene definido usarlo, si no calcularlo
                              const availableAmount = payment.availableAmount !== undefined 
                                ? payment.availableAmount 
                                : Math.max(0, payment.amount - consumedAmount);
                              return (
                                <>
                                  <p className={cn(typography.body.large, "flex items-center gap-1 font-bold", availableAmount > 0 ? "text-blue-600" : "text-green-600")}>
                                    <Banknote className="h-4 w-4" />
                                    {formatCurrency(availableAmount, payment.currency)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Disponible de {formatCurrency(payment.amount, payment.currency)}
                                    {consumedAmount > 0 && ` · ${formatCurrency(consumedAmount, payment.currency)} usado (${payment.children?.length || 0} cuota${(payment.children?.length || 0) > 1 ? 's' : ''})`}
                                  </p>
                                </>
                              );
                            })()
                          ) : payment.status === 'pagado' && payment.balanceDue === 0 ? (
                            <p className={cn(typography.body.large, "flex items-center gap-1 font-bold text-green-600")}>
                              <CheckCircle2 className="h-4 w-4" />
                              Saldado
                            </p>
                          ) : payment.balanceDue === 0 ? (
                            /* Balance cubierto por abonos pero status sigue pendiente */
                            <p className={cn(typography.body.large, "flex items-center gap-1 font-bold text-blue-600")}>
                              <Banknote className="h-4 w-4" />
                              Cubierto
                            </p>
                          ) : (
                            <>
                              {payment.status === 'abonado' || payment.status === 'pendiente' || payment.status === 'retrasado' ? (
                                <div>
                                  <p className={cn(typography.body.large, "flex items-center gap-1 font-bold", lateFee > 0 ? "text-red-600" : "text-yellow-600")}>
                                    <Banknote className="h-4 w-4" />
                                    Falta: {formatCurrency(pendingBalance, payment.currency)}
                                  </p>
                                  {lateFee > 0 && (
                                    <p className="text-xs text-red-600 font-medium">
                                      + {formatCurrency(lateFee, payment.currency)} penalidad
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Cuota: {formatCurrency(payment.amount, payment.currency)} · Abonado: {formatCurrency(Math.max(0, payment.amount - pendingBalance), payment.currency)}
                                  </p>
                                  {lateFee > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Total a pagar: {formatCurrency(totalToPay, payment.currency)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <p className={cn(typography.body.large, "flex items-center gap-1 font-bold", lateFee > 0 ? "text-red-600" : "text-yellow-600")}>
                                    <Banknote className="h-4 w-4" />
                                    {formatCurrency(totalToPay, payment.currency)}
                                  </p>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        /* Caso sin hijos */
                        <div>
                          {payment.status === 'adelanto' ? (
                            /* Adelanto sin hijos: mostrar monto total disponible */
                            (() => {
                              const availableAmount = payment.availableAmount !== undefined 
                                ? payment.availableAmount 
                                : payment.amount;
                              return (
                                <>
                                  <p className={cn(typography.body.large, "flex items-center gap-1 font-bold text-blue-600")}>
                                    <Banknote className="h-4 w-4" />
                                    {formatCurrency(availableAmount, payment.currency)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Disponible de {formatCurrency(payment.amount, payment.currency)}
                                  </p>
                                </>
                              );
                            })()
                          ) : (
                            /* Otros casos sin hijos: mostrar monto + penalidad si aplica */
                            <>
                              {payment.status === 'abonado' || payment.status === 'pendiente' || payment.status === 'retrasado' ? (
                                <div>
                                  <p className={cn(typography.body.large, "flex items-center gap-1 font-bold", lateFee > 0 ? "text-red-600" : "text-yellow-600")}>
                                    <Banknote className="h-4 w-4" />
                                    Falta: {formatCurrency(pendingBalance, payment.currency)}
                                  </p>
                                  {lateFee > 0 && (
                                    <p className="text-xs text-red-600 font-medium">
                                      + {formatCurrency(lateFee, payment.currency)} penalidad
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Cuota: {formatCurrency(payment.amount, payment.currency)} · Abonado: {formatCurrency(Math.max(0, payment.amount - pendingBalance), payment.currency)}
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <p className={cn(typography.body.large, "flex items-center gap-1", lateFee > 0 ? "font-bold text-red-600" : "")}>
                                    <Banknote className="h-4 w-4" />
                                    {formatCurrency(totalToPay, payment.currency)}
                                  </p>
                                  {lateFee > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      De {formatCurrency(payment.amount, payment.currency)} · +{formatCurrency(lateFee, payment.currency)} penalidad
                                    </p>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              
              <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-1">
                {onAssociateToParent && !payment.parentId && (
                  <button
                    onClick={(e) => openAssociateModal(payment, e)}
                    className="p-1 hover:bg-blue-100 rounded-full text-blue-500 transition-colors cursor-pointer"
                    title="Asociar a recibo"
                  >
                    <Link2 className="h-4 w-4" />
                  </button>
                )}
                {onDisassociateFromParent && payment.parentId && (
                  <button
                    onClick={(e) => handleDisassociate(payment, e)}
                    className="p-1 hover:bg-orange-100 rounded-full text-orange-500 transition-colors cursor-pointer"
                    title={`Desasociar de ${payment.parentReceiptNumber || 'recibo padre'}`}
                  >
                    <Unlink className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-1">
                {onPayPending && payment.status === "pendiente" && (
                  <button
                    onClick={(e) => openPayPendingModal(payment, e)}
                    className="p-1.5 hover:bg-green-100 rounded-full text-green-600 transition-colors cursor-pointer"
                    title="Pagar cuota"
                  >
                    <CreditCard className="h-4 w-4" />
                  </button>
                )}
                
                {onDeletePayment && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePayment(payment);
                    }}
                    className="p-1 hover:bg-red-100 rounded-full text-red-500 transition-colors cursor-pointer"
                    title="Eliminar cuota"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                
                {payment.children && payment.children.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleParentExpand(payment.id);
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors cursor-pointer"
                    title={expandedParents.has(payment.id) ? "Colapsar" : "Expandir"}
                  >
                    {expandedParents.has(payment.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              
              {onPaymentClick && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
        
        {/* Renderizar hijos */}
        {payment.children && payment.children.length > 0 && expandedParents.has(payment.id) && (
          <div className="mt-3 ml-4 pl-4 border-l-2 border-dashed border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">
                Pagos vinculados ({payment.children.length})
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {payment.children.map((child) => (
                <DraggableChildItem
                  key={child.id}
                  child={child}
                  onPaymentClick={onPaymentClick}
                  onDisassociateFromParent={onDisassociateFromParent}
                  onDisassociate={handleChildDisassociate}
                  onDeletePayment={handleChildDelete}
                  getShortIdentifier={getShortIdentifier}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <Card className={cn(components.card, className)}>
      <CardHeader className={cn(spacing.card.header, "flex flex-row items-center justify-between flex-wrap gap-2")}>
        <CardTitle className={cn(typography.h4, "flex items-center gap-2")}>
          <Calendar className="h-5 w-5" />
          {title}
        </CardTitle>
        
        <div className="flex items-center gap-2 flex-wrap">
          {showSimulationControls && (
            <div className="flex items-center gap-2 mr-2 p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex flex-col items-center px-2 border-r border-purple-200 dark:border-purple-700">
                <span className="text-[10px] uppercase tracking-wider text-purple-600 dark:text-purple-400 font-semibold">Semana</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                    onClick={() => onWeekChange?.(Math.max(1, currentWeek - 1))}
                    disabled={currentWeek <= 1}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <input
                    type="number"
                    min={1}
                    value={currentWeek}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1) {
                        onWeekChange?.(val);
                      }
                    }}
                    className="text-sm font-bold text-purple-700 dark:text-purple-300 w-12 text-center bg-transparent border-b border-purple-300 dark:border-purple-600 focus:outline-none focus:border-purple-500"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                    onClick={() => onWeekChange?.(currentWeek + 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <span className="text-xs text-purple-700 dark:text-purple-400 font-medium">Simular:</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 text-xs"
                onClick={handleSimulateTuesday}
                disabled={isSimulatingTuesday}
              >
                {isSimulatingTuesday ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Martes
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 text-xs"
                onClick={handleSimulateFriday}
                disabled={isSimulatingFriday}
              >
                {isSimulatingFriday ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}
                Viernes
              </Button>
            </div>
          )}
          
          <PaymentExport
            payments={filteredPayments}
            selectedStatuses={selectedStatuses}
            containerRef={timelineRef}
            financingNumber={financingNumber}
            financingId={financingId}
            clientName={clientName}
            vehicleName={vehicleName}
            totalAmount={totalAmount}
            currentBalance={currentBalance}
          />
        
          {showFilters && (
            <div className="flex items-center gap-2">
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {periodFilter === "custom" && (
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                      <Filter className="h-3 w-3" />
                      Fechas
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <h4 className={typography.body.large}>Rango de fechas</h4>
                      </div>
                      <div className="grid gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="startDate" className="text-xs">Desde</Label>
                          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="endDate" className="text-xs">Hasta</Label>
                          <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setIsFilterOpen(false)}>Aplicar</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <div ref={timelineRef} className="contents">
        <CardContent className={cn("flex flex-col", spacing.gap.medium, spacing.card.content)}>
          {hasActiveFilters && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Mostrando: <strong className="text-foreground">{periodOptions.find(p => p.value === periodFilter)?.label}</strong>
              </span>
              <span className={cn(typography.body.large, "text-primary font-bold")}>
                Total recaudado: {formatCurrency(summary.totalCollected)}
              </span>
            </div>
          )}

          {showSummary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {(["pagado", "pendiente", "abonado", "adelanto", "retrasado"] as PaymentStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={cn(
                      "rounded-lg p-3 text-center cursor-pointer hover:opacity-80 transition-opacity",
                      statusConfig[status].bgColor,
                      "border-2",
                      selectedStatuses.includes(status) ? "border-gray-800 ring-2 ring-offset-1 ring-gray-800" : statusConfig[status].borderColor
                    )}
                  >
                    <p className={cn("text-2xl font-bold", statusConfig[status].textColor)}>
                      {status === "pagado" ? summary.paid : 
                       status === "pendiente" ? summary.pending :
                       status === "abonado" ? summary.partial :
                       status === "adelanto" ? summary.advance :
                       summary.overdue}
                    </p>
                    <p className={cn("text-xs", statusConfig[status].textColor)}>
                      {statusConfig[status].label}
                    </p>
                  </button>
                ))}
                <button
                  onClick={() => toggleStatus("multa")}
                  className={cn(
                    "rounded-lg p-3 text-center cursor-pointer hover:opacity-80 transition-opacity",
                    multaConfig.bgColor,
                    "border-2",
                    selectedStatuses.includes("multa") ? "border-gray-800 ring-2 ring-offset-1 ring-gray-800" : multaConfig.borderColor
                  )}
                >
                  <p className={cn("text-2xl font-bold", multaConfig.textColor)}>
                    {summary.multas}
                  </p>
                  <p className={cn("text-xs", multaConfig.textColor)}>Multas</p>
                </button>
              </div>
              <Separator />
            </>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div 
              className={cn(
                "relative rounded-lg transition-colors",
                isDragging && overId === 'unassigned-zone' && "bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-dashed ring-blue-300"
              )}
            >
              <ScrollAreaPrimitive.Root className="relative overflow-hidden" style={{ height: maxHeight }}>
                <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth will-change-scroll">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p className={typography.body.base}>Cargando pagos...</p>
                    </div>
                  ) : paymentTree.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mb-2 opacity-50" />
                      <p className={typography.body.base}>No hay pagos registrados</p>
                    </div>
                  ) : (
                    <div className="relative pr-4 p-2">
                      <div 
                        className="absolute left-[11px] top-2 w-0.5 bg-border" 
                        style={{ height: `calc(100% - 16px)` }}
                      />
                      
                      {parentPaymentsCount > 0 && (
                        <div className="flex items-center justify-between mb-3 px-2">
                          <div className="flex items-center gap-2">
                            <FolderTree className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {parentPaymentsCount} recibo{parentPaymentsCount > 1 ? 's' : ''} con pagos anidados
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {onAssociateToParent && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <GripVertical className="h-3 w-3" />
                                Arrastra para vincular
                              </span>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={expandAllParents}>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              Expandir
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={collapseAllParents}>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Colapsar
                            </Button>
                          </div>
                        </div>
                      )}

                      {(() => { console.log('[DEBUG] Renderizando paymentTree:', paymentTree.length, 'items'); return null; })()}
                      <div className="flex flex-col gap-4">
                        {paymentTree.map((payment) => {
                          const isDraggable = onAssociateToParent && canDragPayment(payment);
                          const isDropTarget = overId === payment.id && activeDragId !== payment.id;

                          return (
                            <DraggableRootItem
                              key={payment.id}
                              payment={payment}
                              canDrag={!!isDraggable}
                              isOver={isDropTarget}
                              activeDragId={activeDragId}
                            >
                              <ParentContent payment={payment} />
                            </DraggableRootItem>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </ScrollAreaPrimitive.Viewport>
                <ScrollAreaPrimitive.ScrollAreaScrollbar
                  orientation="vertical"
                  className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
                >
                  <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
                </ScrollAreaPrimitive.ScrollAreaScrollbar>
                <ScrollAreaPrimitive.Corner />
              </ScrollAreaPrimitive.Root>
            </div>
            
            <DragOverlay dropAnimation={dropAnimation}>
              {activeDragId ? (
                (() => {
                  const draggedPayment = findPaymentById(activeDragId);
                  if (!draggedPayment) return null;
                  const isMulta = draggedPayment.amount < 0;
                  const config = isMulta ? multaConfig : statusConfig[draggedPayment.status];
                  return (
                    <div 
                      className={cn(
                        "rounded-lg p-3 border shadow-xl cursor-grabbing touch-none select-none",
                        "w-[85vw] max-w-[320px] sm:w-[320px]",
                        config.bgColor,
                        config.borderColor
                      )}
                      style={{ 
                        transform: 'translate3d(0, 0, 0) scale(1.02)',
                        willChange: 'transform',
                        pointerEvents: 'none',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium truncate">{draggedPayment.invoiceNumber}</span>
                        <Badge className="text-xs flex-shrink-0" variant="outline">
                          {formatCurrency(draggedPayment.amount, draggedPayment.currency)}
                        </Badge>
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </DragOverlay>
          </DndContext>

          {showSummary && localPayments.length > 0 && (
            <>
              <Separator />
              <div className="flex justify-between items-center text-sm flex-wrap gap-2">
                <span className={typography.label}>Total de {summary.total} pagos:</span>
                <div className="flex gap-4 flex-wrap">
                  <span className="text-green-600 dark:text-green-400">
                    {formatCurrency(summary.paidAmount)} pagados
                  </span>
                  {summary.partialAmount > 0 && (
                    <span className="text-purple-600 dark:text-purple-400">
                      {formatCurrency(summary.partialAmount)} abonados
                    </span>
                  )}
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {formatCurrency(summary.pendingAmount)} pendientes
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </div>
      
      {/* Modales */}
      <Dialog open={isAbonoModalOpen} onOpenChange={setIsAbonoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del Pago</DialogTitle>
            <DialogDescription>{selectedAbono?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedAbono && (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Monto:</span>
                  <span className="font-bold">{formatCurrency(selectedAbono.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estado:</span>
                  <Badge>{statusConfig[selectedAbono.status]?.label || selectedAbono.status}</Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={closeAbonoDetail} variant="outline">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayPendingOpen} onOpenChange={setIsPayPendingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              Registrar Pago
            </DialogTitle>
            <DialogDescription>{selectedPendingPayment?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Fecha de pago *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={pendingPaymentData.paymentDate}
                onChange={(e) => setPendingPaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmationNumber">Número de confirmación (opcional)</Label>
              <Input
                id="confirmationNumber"
                type="text"
                value={pendingPaymentData.confirmationNumber}
                onChange={(e) => setPendingPaymentData(prev => ({ ...prev, confirmationNumber: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={closePayPendingModal} variant="outline" disabled={isPaying}>Cancelar</Button>
            <Button onClick={handlePayPending} disabled={isPaying || !pendingPaymentData.paymentDate}>
              {isPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssociateModalOpen} onOpenChange={setIsAssociateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-600" />
              Asociar a Recibo
            </DialogTitle>
            <DialogDescription>
              Selecciona el recibo padre al que deseas asociar{' '}
              <span className="font-medium">{selectedPaymentForAssociate?.invoiceNumber}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="parentReceipt">Recibo padre *</Label>
              <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                <SelectTrigger id="parentReceipt">
                  <SelectValue placeholder="Selecciona un recibo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableParents.length === 0 ? (
                    <SelectItem value="" disabled>No hay recibos disponibles</SelectItem>
                  ) : (
                    availableParents
                      .filter(parent => parent.id !== String(selectedPaymentForAssociate?.id))
                      .map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          <div className="flex items-center justify-between gap-4">
                            <span>{parent.receiptNumber}</span>
                            <span className="text-muted-foreground">
                              {formatCurrency(parent.amount)}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={closeAssociateModal} variant="outline">Cancelar</Button>
            <Button onClick={handleAssociate} disabled={!selectedParentId}>
              <Link2 className="mr-2 h-4 w-4" />
              Asociar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
