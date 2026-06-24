"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components_shadcn/ui/toggle-group";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { Sparkles, Trash2, AlertCircle, Plus } from "lucide-react";
import { spacing, typography, commonClasses } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { BackButton } from "@/components/admin/back-button";
import type { DealCard, DealPaymentAgreement } from "@/validations/types";

const DetailsSkeleton = () => (
  <div className="mx-auto w-full max-w-2xl">
    <div className={`flex flex-col ${spacing.gap.xlarge} pb-32`}>
      <section>
        <Skeleton className="h-6 w-32 mb-3" />
        <Card className={commonClasses.card}>
          <CardContent className={`flex flex-col ${spacing.gap.medium} ${spacing.card.padding}`}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </section>
      <section>
        <Skeleton className="h-6 w-40 mb-3" />
        <Card className={commonClasses.card}>
          <CardContent className={`flex flex-col ${spacing.gap.medium} ${spacing.card.padding}`}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </section>
    </div>
  </div>
);

export default function DealDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [deal, setDeal] = useState<DealCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [summary, setSummary] = useState("");
  const [price, setPrice] = useState("");
  const [paymentAgreement, setPaymentAgreement] = useState<DealPaymentAgreement>("semanal");
  const [newClauseTitle, setNewClauseTitle] = useState("");
  const [newClauseDescription, setNewClauseDescription] = useState("");

  useEffect(() => {
    const fetchDeal = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/deal/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setDeal(null);
            return;
          }
          throw new Error("Error al cargar el contrato");
        }
        const result = await response.json();
        const dealData = result.data as DealCard;
        setDeal(dealData);

        // Initialize form state
        setSummary(dealData.summary || "");
        setPrice(dealData.price?.toString() || "");
        setPaymentAgreement(dealData.paymentAgreement || "semanal");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchDeal();
    }
  }, [id]);

  const backButton = <BackButton fallbackHref="/deal" />;

  const handleSaveDraft = async () => {
    if (!deal) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/deal/${deal.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            summary,
            price: price ? parseFloat(price) : undefined,
            paymentAgreement,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar el contrato");
      }

      const result = await response.json();
      setDeal(result.data);
    } catch (err) {
      console.error("Error saving deal:", err);
      alert("Error al guardar el contrato");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!deal) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/deal/${deal.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            summary,
            price: price ? parseFloat(price) : undefined,
            paymentAgreement,
            status: "pendiente",
            generatedAt: new Date().toISOString().split("T")[0],
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Error al generar el contrato");
      }

      const result = await response.json();
      setDeal(result.data);
      alert("Contrato generado exitosamente");
    } catch (err) {
      console.error("Error generating deal:", err);
      alert("Error al generar el contrato");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddClause = async () => {
    if (!deal || !newClauseTitle.trim()) return;

    try {
      const response = await fetch(`/api/deal/${deal.documentId}/clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            title: newClauseTitle,
            description: newClauseDescription || undefined,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Error al agregar la cláusula");
      }

      const result = await response.json();
      setDeal({
        ...deal,
        clauses: [...deal.clauses, result.data],
      });
      setNewClauseTitle("");
      setNewClauseDescription("");
    } catch (err) {
      console.error("Error adding clause:", err);
      alert("Error al agregar la cláusula");
    }
  };

  const handleDeleteClause = async (clauseDocumentId: string) => {
    if (!deal || !clauseDocumentId) return;

    try {
      const response = await fetch(
        `/api/deal/${deal.documentId}/clauses?clauseId=${clauseDocumentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Error al eliminar la cláusula");
      }

      setDeal({
        ...deal,
        clauses: deal.clauses.filter(
          (c) => c.documentId !== clauseDocumentId && c.id !== clauseDocumentId
        ),
      });
    } catch (err) {
      console.error("Error deleting clause:", err);
      alert("Error al eliminar la cláusula");
    }
  };

  const handleDeleteDiscount = async (discountDocumentId: string) => {
    if (!deal || !discountDocumentId) return;

    try {
      const response = await fetch(
        `/api/deal/${deal.documentId}/discounts?discountId=${discountDocumentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Error al eliminar el descuento");
      }

      setDeal({
        ...deal,
        discounts: deal.discounts.filter(
          (d) => d.documentId !== discountDocumentId && d.id !== discountDocumentId
        ),
      });
    } catch (err) {
      console.error("Error deleting discount:", err);
      alert("Error al eliminar el descuento");
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Editor de Contrato" showFilterAction leftActions={backButton}>
        <DetailsSkeleton />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Editor de Contrato" showFilterAction leftActions={backButton}>
        <section className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </section>
      </AdminLayout>
    );
  }

  if (!deal) {
    return (
      <AdminLayout title="Editor de Contrato" showFilterAction leftActions={backButton}>
        <section
          className={`flex flex-col items-center justify-center ${spacing.gap.base} min-h-[300px]`}
        >
          <p className={typography.body.large}>Contrato no encontrado</p>
          <Button onClick={() => router.push("/deal")}>Ver contratos</Button>
        </section>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Editor de Contrato" showFilterAction leftActions={backButton}>
      <div className="mx-auto w-full max-w-2xl">
        <div className={`flex flex-col ${spacing.gap.xlarge} pb-32`}>
          {/* Tipo de Contrato */}
          <section>
            <h2 className={`${typography.h4} mb-3`}>Tipo de Contrato</h2>
            <Card className={commonClasses.card}>
              <CardContent
                className={`flex flex-col ${spacing.gap.medium} ${spacing.card.padding}`}
              >
                <p className={`${typography.body.large} font-bold`}>{deal.typeLabel}</p>
                <p className={`${typography.body.small} text-muted-foreground`}>
                  Estado: {deal.statusLabel}
                </p>
                {deal.generatedAtLabel && (
                  <p className={`${typography.body.small} text-muted-foreground`}>
                    Generado: {deal.generatedAtLabel}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Datos del Cliente */}
          <section>
            <h2 className={`${typography.h4} mb-3`}>Datos del Cliente</h2>
            <Card className={commonClasses.card}>
              <CardContent
                className={`flex flex-col ${spacing.gap.medium} ${spacing.card.padding}`}
              >
                <div className="flex flex-col gap-1">
                  <Label className={typography.label}>Nombre Completo</Label>
                  <Input value={deal.clientName || ""} disabled className="rounded-lg bg-muted" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className={typography.label}>Email</Label>
                  <Input value={deal.clientEmail || ""} disabled className="rounded-lg bg-muted" />
                </div>
                {deal.clientPhone && (
                  <div className="flex flex-col gap-1">
                    <Label className={typography.label}>Teléfono</Label>
                    <Input value={deal.clientPhone} disabled className="rounded-lg bg-muted" />
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Detalles del Vehículo */}
          <section>
            <h2 className={`${typography.h4} mb-3`}>Detalles del Vehículo</h2>
            <Card className={commonClasses.card}>
              <CardContent
                className={`flex flex-col ${spacing.gap.medium} ${spacing.card.padding}`}
              >
                <div className="flex flex-col gap-1">
                  <Label className={typography.label}>Vehículo</Label>
                  <Input
                    value={deal.vehicleName || "Sin vehículo asignado"}
                    disabled
                    className="rounded-lg bg-muted"
                  />
                </div>
                {deal.vehiclePlaca && (
                  <div className="flex flex-col gap-1">
                    <Label className={typography.label}>Placa</Label>
                    <Input value={deal.vehiclePlaca} disabled className="rounded-lg bg-muted" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="price" className={typography.label}>
                    Precio (PAB)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      id="price"
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="rounded-lg bg-muted pl-7"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Términos del Contrato */}
          <section>
            <h2 className={`${typography.h4} mb-3`}>Términos del Contrato</h2>
            <Card className={commonClasses.card}>
              <CardContent
                className={`flex flex-col ${spacing.gap.medium} ${spacing.card.padding}`}
              >
                <div className="flex flex-col gap-1">
                  <Label className={typography.label}>Acuerdo de Pago</Label>
                  <ToggleGroup
                    type="single"
                    value={paymentAgreement}
                    onValueChange={(value) => {
                      if (value === "semanal" || value === "quincenal") {
                        setPaymentAgreement(value);
                      }
                    }}
                    className="mt-2"
                  >
                    <ToggleGroupItem
                      value="semanal"
                      className={`flex items-center justify-center flex-1 rounded-lg border py-2.5 text-sm font-bold transition-colors ${
                        paymentAgreement === "semanal"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Semanal
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="quincenal"
                      className={`flex items-center justify-center flex-1 rounded-lg border py-2.5 text-sm font-bold transition-colors ${
                        paymentAgreement === "quincenal"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Quincenal
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="summary" className={typography.label}>
                    Resumen / Notas
                  </Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Añadir notas o resumen del contrato..."
                    rows={4}
                    className="rounded-lg bg-muted"
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Cláusulas */}
          <section>
            <h2 className={`${typography.h4} mb-3`}>Cláusulas</h2>
            <div className={`flex flex-col ${spacing.gap.base}`}>
              {deal.clauses.map((clause) => (
                <Card key={clause.documentId || clause.id} className={commonClasses.card}>
                  <CardContent className={`flex items-start gap-3 ${spacing.card.padding}`}>
                    <div className="flex-1">
                      <h3 className={`${typography.body.base} font-bold`}>{clause.title}</h3>
                      {clause.description && (
                        <p className={`${typography.body.small} mt-1 text-muted-foreground`}>
                          {clause.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClause(clause.documentId || clause.id)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* Agregar nueva cláusula */}
              <Card className={commonClasses.card}>
                <CardContent
                  className={`flex flex-col ${spacing.gap.medium} ${spacing.card.padding}`}
                >
                  <Input
                    placeholder="Título de la cláusula..."
                    value={newClauseTitle}
                    onChange={(e) => setNewClauseTitle(e.target.value)}
                    className="rounded-lg bg-muted"
                  />
                  <Textarea
                    placeholder="Descripción (opcional)..."
                    value={newClauseDescription}
                    onChange={(e) => setNewClauseDescription(e.target.value)}
                    rows={2}
                    className="rounded-lg bg-muted"
                  />
                  <Button
                    variant="ghost"
                    onClick={handleAddClause}
                    disabled={!newClauseTitle.trim()}
                    className="flex items-center justify-center gap-1.5 text-sm font-bold text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    Añadir Cláusula
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Descuentos Aplicables */}
          {deal.discounts.length > 0 && (
            <section>
              <h2 className={`${typography.h4} mb-3`}>Descuentos Aplicables</h2>
              <div className={`flex flex-col ${spacing.gap.base}`}>
                {deal.discounts.map((discount) => (
                  <Card
                    key={discount.documentId || discount.id}
                    className="rounded-xl border border-blue-200 bg-blue-50 shadow-sm"
                  >
                    <CardContent className={`flex items-start gap-3 ${spacing.card.padding}`}>
                      <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <h3 className={`${typography.body.base} font-bold text-primary`}>
                          {discount.title}
                        </h3>
                        {discount.description && (
                          <p className={`${typography.body.small} mt-1 text-blue-800`}>
                            {discount.description}
                          </p>
                        )}
                        <p className={`${typography.body.base} font-bold text-primary mt-2`}>
                          - {discount.amountLabel}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDiscount(discount.documentId || discount.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Vendedor */}
          {deal.sellerName && (
            <section>
              <h2 className={`${typography.h4} mb-3`}>Vendedor Asignado</h2>
              <Card className={commonClasses.card}>
                <CardContent
                  className={`flex flex-col ${spacing.gap.small} ${spacing.card.padding}`}
                >
                  <p className={`${typography.body.base} font-medium`}>{deal.sellerName}</p>
                  {deal.sellerEmail && (
                    <p className={`${typography.body.small} text-muted-foreground`}>
                      {deal.sellerEmail}
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t bg-background px-0 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <div className={`flex ${spacing.gap.base}`}>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex flex-1 items-center justify-center rounded-lg border-primary bg-background py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
            >
              {isSaving ? "Guardando..." : "Guardar Borrador"}
            </Button>
            <Button
              onClick={handleGenerateContract}
              disabled={isSaving}
              className="flex flex-1 items-center justify-center rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {isSaving ? "Procesando..." : "Generar Contrato"}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
