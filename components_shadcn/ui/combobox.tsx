"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components_shadcn/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components_shadcn/ui/popover";
import { strapiImages } from "@/lib/strapi-images";

export interface ComboboxOption {
  value: string | number;
  label: string;
  email?: string;
  avatar?: {
    url?: string;
    alternativeText?: string;
  };
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | number;
  onValueChange?: (value: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecciona...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados.",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [commandKey, setCommandKey] = React.useState(0);

  const selectedOption = options.find((option) => {
    return (
      option.value === value ||
      Number(option.value) === Number(value) ||
      String(option.value) === String(value)
    );
  });

  const handleSelect = (selectedValue: string | number) => {
    if (onValueChange) {
      onValueChange(selectedValue);
    }
    setOpen(false);
  };

  // Resetear el filtro cuando se abre el popover usando una key
  React.useEffect(() => {
    if (open) {
      setCommandKey((prev) => prev + 1);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-state={open ? "open" : "closed"}
          className={cn(
            "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring data-[state=open]:border-ring data-[state=closed]:border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow,border-color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 data-[state=open]:ring-2 data-[state=open]:ring-ring/50 data-[state=open]:ring-offset-0 data-[state=closed]:ring-0 disabled:cursor-not-allowed disabled:opacity-50 h-9",
            className
          )}
        >
          <span className={cn(
            "flex-1 text-left truncate",
            !selectedOption && "text-muted-foreground"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-background text-foreground border-border shadow-md" 
        align="end"
        side="top"
        sideOffset={4}
        avoidCollisions={false}
      >
        <Command 
          key={commandKey}
          className="bg-background text-foreground" 
          shouldFilter={true}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[400px] overflow-y-auto">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = 
                  option.value === value ||
                  Number(option.value) === Number(value) ||
                  String(option.value) === String(value);
                
                const itemSearchValue = option.email 
                  ? `${option.label} ${option.email}` 
                  : option.label;
                
                return (
                  <CommandItem
                    key={option.value}
                    value={itemSearchValue}
                    onSelect={(currentValue) => {
                      // El onSelect recibe el value del item, pero necesitamos usar option.value
                      handleSelect(option.value);
                    }}
                    className="cursor-pointer"
                    aria-selected={isSelected}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      {option.avatar?.url ? (
                        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(option.avatar.url)}
                            alt={option.avatar.alternativeText || option.label}
                            fill
                            className="object-cover"
                            sizes="24px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
                          <span className="text-xs font-semibold text-primary">
                            {option.label.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span>{option.label}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


















