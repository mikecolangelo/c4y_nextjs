"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { X, Wrench } from "lucide-react";

export interface InventoryItemOption {
  id: string | number;
  documentId?: string;
  code: string;
  description: string;
  salePrice?: number;
  unitCost?: number;
}

export interface UsedItem {
  inventoryItem: string | number;
  code: string;
  description: string;
  quantity: number;
  unitPriceAtMoment: number;
}

interface InventoryItemSelectorProps {
  inventoryItems: InventoryItemOption[];
  usedItems: UsedItem[];
  onAdd: (item: InventoryItemOption) => void;
  onRemove: (itemId: string | number) => void;
  onUpdateQuantity: (itemId: string | number, quantity: string) => void;
  onUpdatePrice: (itemId: string | number, price: string) => void;
  isLoading?: boolean;
  label?: string;
}

export function InventoryItemSelector({
  inventoryItems,
  usedItems,
  onAdd,
  onRemove,
  onUpdateQuantity,
  onUpdatePrice,
  isLoading,
  label = "Repuestos / Materiales",
}: InventoryItemSelectorProps) {
  const availableItems = inventoryItems.filter(
    (i) => !usedItems.find((u) => String(u.inventoryItem) === String(i.id))
  );

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Wrench className="h-4 w-4" />
        {label}
      </Label>

      {usedItems.length > 0 && (
        <div className="space-y-3 mb-3">
          {usedItems.map((item) => (
            <div
              key={item.inventoryItem}
              className="flex flex-col gap-2 p-3 bg-muted/50 rounded-md border border-border/50"
            >
              {/* Fila superior: código + descripción + eliminar */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" title={item.code}>
                    {item.code}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" title={item.description}>
                    {item.description}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(item.inventoryItem)}
                  className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0 mt-0.5"
                  type="button"
                  title="Eliminar repuesto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Fila inferior: cantidad, precio unitario y total con labels */}
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Cantidad
                  </Label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateQuantity(item.inventoryItem, e.target.value)
                    }
                    className="w-20 h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Precio unitario
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPriceAtMoment}
                    onChange={(e) =>
                      onUpdatePrice(item.inventoryItem, e.target.value)
                    }
                    className="w-full h-8 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Total
                  </Label>
                  <p className="h-8 flex items-center text-sm font-semibold tabular-nums whitespace-nowrap">
                    ${(item.quantity * item.unitPriceAtMoment).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Select
        value="none"
        onValueChange={(value) => {
          if (value !== "none") {
            const item = inventoryItems.find(
              (i) => String(i.id) === value
            );
            if (item) onAdd(item);
          }
        }}
        disabled={isLoading || availableItems.length === 0}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              isLoading
                ? "Cargando..."
                : availableItems.length === 0
                ? "No hay items"
                : "Agregar repuesto..."
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Seleccionar repuesto...</SelectItem>
          {availableItems.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              <div className="flex items-center justify-between w-full">
                <span>{item.code}</span>
                <span className="text-muted-foreground ml-2">
                  {item.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
