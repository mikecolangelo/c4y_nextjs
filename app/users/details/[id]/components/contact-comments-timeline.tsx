"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Avatar, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { typography } from "@/lib/design-system";
import { Can } from "@/components/auth/can";
import { toast } from "@/lib/toast";
import { clientLogger } from "@/lib/client-logger";

interface ContactComment {
  id: number;
  documentId: string;
  content: string;
  authorName?: string | null;
  createdAt: string;
}

interface ContactCommentsTimelineProps {
  /** documentId of the contact (user-profile) being viewed. */
  contactDocumentId: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Comment timeline for a contact's detail page: lists existing comments
 * (newest first) and lets an admin add or remove entries.
 */
export function ContactCommentsTimeline({ contactDocumentId }: ContactCommentsTimelineProps) {
  const [comments, setComments] = useState<ContactComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endpoint = `/api/user-profiles/${contactDocumentId}/comments`;

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { data } = await response.json();
      setComments(data ?? []);
    } catch (error) {
      clientLogger.error("Error loading contact comments", error);
      toast.error("No pudimos cargar los comentarios.");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { data } = await response.json();
      setComments((prev) => [data, ...prev]);
      setDraft("");
    } catch (error) {
      clientLogger.error("Error creating contact comment", error);
      toast.error("No pudimos guardar el comentario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.documentId !== documentId));
    try {
      const response = await fetch(`/api/user-comments/${documentId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      clientLogger.error("Error deleting contact comment", error);
      toast.error("No pudimos eliminar el comentario.");
      setComments(previous); // Roll back the optimistic removal.
    }
  };

  return (
    <Card className="shadow-sm ring-1 ring-inset ring-border/50">
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle className={`${typography.h4} flex items-center gap-2`}>
          <MessageSquare className="h-5 w-5" />
          Comentarios
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {/* Composer */}
        <Can module="users" action="canUpdate">
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe un comentario..."
              rows={3}
              disabled={isSubmitting}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!draft.trim() || isSubmitting}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "Guardando..." : "Comentar"}
              </Button>
            </div>
          </div>
        </Can>

        {/* Timeline */}
        <div className="mt-6 flex flex-col gap-4">
          {isLoading ? (
            [1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : comments.length === 0 ? (
            <p className={`${typography.body.small} text-muted-foreground`}>
              Aún no hay comentarios. Sé el primero en agregar uno.
            </p>
          ) : (
            comments.map((comment) => {
              const author = comment.authorName || "Usuario";
              return (
                <article key={comment.documentId} className="group flex gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-muted text-xs">{initials(author)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`${typography.body.base} font-medium`}>{author}</p>
                      <div className="flex items-center gap-2">
                        <time className={`${typography.body.small} text-muted-foreground`}>
                          {formatDistanceToNow(new Date(comment.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </time>
                        <Can module="users" action="canDelete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => handleDelete(comment.documentId)}
                            aria-label="Eliminar comentario"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </Can>
                      </div>
                    </div>
                    <p className={`${typography.body.base} whitespace-pre-wrap break-words`}>
                      {comment.content}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
