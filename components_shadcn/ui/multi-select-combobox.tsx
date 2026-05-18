"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
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

export interface MultiSelectOption {
  value: string | number;
  label: string;
  email?: string;
  avatar?: {
    url?: string;
    alternativeText?: string;
  };
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  selectedValues: (string | number)[];
  onSelectionChange: (values: (string | number)[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelectCombobox({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Selecciona...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados.",
  className,
  disabled = false,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [commandKey, setCommandKey] = React.useState(0);

  const handleUnselect = (value: string | number) => {
    onSelectionChange(selectedValues.filter((v) => {
      // Mantener solo los valores que NO coinciden (eliminar el que coincide)
      const matches = v === value || 
                      Number(v) === Number(value) ||
                      String(v) === String(value);
      return !matches;
    }));
  };

  const handleSelect = (value: string | number) => {
    // Verificar si el valor ya está seleccionado usando comparación robusta
    const isSelected = selectedValues.some((v) => {
      return v === value || 
             Number(v) === Number(value) ||
             String(v) === String(value);
    });
    
    if (isSelected) {
      handleUnselect(value);
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const selectedOptions = options.filter((option) =>
    selectedValues.some(
      (val) => val === option.value || 
      Number(val) === Number(option.value) ||
      String(val) === String(option.value)
    )
  );

  const getDisplayText = () => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }
    if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    }
    return `${selectedOptions.length} seleccionados`;
  };

  // Resetear el filtro cuando se abre el popover usando una key
  React.useEffect(() => {
    if (open) {
      setCommandKey((prev) => prev + 1);
    }
  }, [open]);

  // Crear un mapa de searchValue a option para identificar rápidamente elementos seleccionados
  const valueToOptionMap = React.useMemo(() => {
    const map = new Map<string, typeof options[0]>();
    options.forEach((opt) => {
      const searchValue = opt.email 
        ? `${opt.label} ${opt.email}` 
        : opt.label;
      const normalizedKey = searchValue.toLowerCase().trim();
      // Guardar tanto con el key normalizado como con el original para mayor compatibilidad
      map.set(normalizedKey, opt);
      // También guardar con el valor exacto para casos edge
      map.set(searchValue, opt);
    });
    return map;
  }, [options]);

  // Función de filtrado personalizada que siempre incluye elementos seleccionados
  const filterFunction = React.useCallback((value: string, search: string, keywords?: string[]) => {
    // Normalizar valores para comparación
    const normalizedValue = value.toLowerCase().trim();
    const normalizedSearch = search.toLowerCase().trim();
    
    // Buscar la opción correspondiente al valor
    const option = valueToOptionMap.get(normalizedValue);
    
    if (!option) {
      // Si no encontramos la opción, usar filtro por defecto
      if (!normalizedSearch) return 1;
      return normalizedValue.includes(normalizedSearch) ? 1 : 0;
    }
    
    // Verificar si el elemento está seleccionado (comparar con todos los valores seleccionados)
    const isSelected = selectedValues.some(
      (val) => 
        val === option.value || 
        Number(val) === Number(option.value) ||
        String(val) === String(option.value)
    );
    
    // Si el elemento está seleccionado, SIEMPRE mostrarlo (retornar 1)
    if (isSelected) {
      return 1; // Siempre mostrar elementos seleccionados, independientemente de la búsqueda
    }
    
    // Para elementos NO seleccionados, aplicar el filtro de búsqueda
    if (!normalizedSearch) {
      return 1; // Sin búsqueda, mostrar todos los no seleccionados
    }
    
    // Verificar si coincide con el valor (label o email)
    if (normalizedValue.includes(normalizedSearch)) {
      return 1;
    }
    
    // Verificar keywords si están disponibles
    if (keywords && keywords.length > 0) {
      const matchesKeyword = keywords.some(keyword => 
        keyword.toLowerCase().trim().includes(normalizedSearch)
      );
      if (matchesKeyword) {
        return 1;
      }
    }
    
    return 0; // No coincide con la búsqueda, ocultar
  }, [valueToOptionMap, selectedValues]);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
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
            selectedOptions.length === 0 && "text-muted-foreground"
          )}>
            {getDisplayText()}
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
          filter={filterFunction}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[400px] overflow-y-auto">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {/* Grupo de opciones seleccionadas - siempre visible, sin filtro */}
            {selectedOptions.length > 0 && (
              <CommandGroup heading="Seleccionados">
                {selectedOptions.map((option) => {
                  // Comparación más robusta que maneja números y strings
                  const isSelected = selectedValues.some(
                    (val) => val === option.value || 
                    Number(val) === Number(option.value) ||
                    String(val) === String(option.value)
                  );
                  const searchValue = option.email 
                    ? `${option.label} ${option.email}` 
                    : option.label;
                  return (
                    <CommandItem
                      key={option.value}
                      data-cmdk-item
                      data-option-value={String(option.value)}
                      value={searchValue}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer"
                      aria-selected={isSelected}
                      keywords={[option.label, option.email || ""].filter(Boolean)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelect(option.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mr-2 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                        aria-label={`Seleccionar ${option.label}`}
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
            )}
            {/* Grupo de opciones no seleccionadas */}
            {selectedOptions.length > 0 && (
              <CommandGroup heading="Disponibles">
                {options
                  .filter((option) => !selectedValues.some(
                    (val) => val === option.value || 
                    Number(val) === Number(option.value) ||
                    String(val) === String(option.value)
                  ))
                  .map((option) => {
                    const isSelected = selectedValues.some(
                      (val) => val === option.value || 
                      Number(val) === Number(option.value) ||
                      String(val) === String(option.value)
                    );
                    const searchValue = option.email 
                      ? `${option.label} ${option.email}` 
                      : option.label;
                    return (
                      <CommandItem
                        key={option.value}
                        data-cmdk-item
                        data-option-value={String(option.value)}
                        value={searchValue}
                        onSelect={() => handleSelect(option.value)}
                        className="cursor-pointer"
                        aria-selected={isSelected}
                        keywords={[option.label, option.email || ""].filter(Boolean)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(option.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="mr-2 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                          aria-label={`Seleccionar ${option.label}`}
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
            )}
            {/* Si no hay seleccionados, mostrar todas las opciones normalmente */}
            {selectedOptions.length === 0 && (
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selectedValues.some(
                    (val) => val === option.value || 
                    Number(val) === Number(option.value) ||
                    String(val) === String(option.value)
                  );
                  const searchValue = option.email 
                    ? `${option.label} ${option.email}` 
                    : option.label;
                  return (
                    <CommandItem
                      key={option.value}
                      data-cmdk-item
                      data-option-value={String(option.value)}
                      value={searchValue}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer"
                      aria-selected={isSelected}
                      keywords={[option.label, option.email || ""].filter(Boolean)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelect(option.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mr-2 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                        aria-label={`Seleccionar ${option.label}`}
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
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
