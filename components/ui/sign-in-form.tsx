"use client";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components_shadcn/ui/form";
import { Input } from "@/components_shadcn/ui/input";
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components_shadcn/ui/card";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SinginFormData } from "@/validations/types";
import { actions } from "@/actions";
import { type FormState, SignInFormSchema } from "@/validations/auth";
import { FormError } from "./form-error";
import { Loader2 } from "lucide-react";

interface SignInFormProps {
  data: SinginFormData;
}

const INITIAL_STATE: FormState = {
  data: {
    identifier: "",
    password: "",
  },
  zodErrors: null,
  strapiErrors: undefined,
  success: false,
  isLoading: false,
  message: undefined,
};

export function SignInForm({ data }: SignInFormProps) {
  // Hooks primero (reglas de React)
  const [formState, setFormState] = useState<FormState>(INITIAL_STATE);
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof SignInFormSchema>>({
    resolver: zodResolver(SignInFormSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  // Verificación de data después de los hooks
  if (!data) return null;

  const {
    header,
    email_label,
    email_placeholder,
    password_label,
    password_placeholder,
    submit_button,
    singup_previous_link_text,
    singup_link,
  } = data;

  const singupLink = singup_link?.[0];

  async function onSubmit(values: z.infer<typeof SignInFormSchema>) {
    const formData = new FormData();
    formData.append("identifier", values.identifier);
    formData.append("password", values.password);

    startTransition(async () => {
      try {
        const result = await actions.auth.loginUserAction(formState, formData);
        if (result) {
          if (result.redirectTo) {
            window.location.href = result.redirectTo;
            return;
          }
          setFormState(result);
        }
      } catch (error) {
        console.error("Login error:", error);
        setFormState({
          ...INITIAL_STATE,
          strapiErrors: {
            status: 500,
            name: "Error",
            message: "Error inesperado al iniciar sesión. Intente nuevamente.",
          },
        });
      }
    });
  }

  // Asegurar que formState siempre tenga un valor válido
  const safeFormState = formState || INITIAL_STATE;

  return (
    <>
      <Card className="w-full py-8 px-8 bg-card">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-3xl font-bold text-foreground text-center">{header.title}</CardTitle>
          <CardDescription className="text-base text-center text-muted-foreground">
            {header.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Form {...form}>
            <div className="space-y-6">
              <FormField 
                control={form.control} 
                name="identifier" 
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-base font-medium text-foreground">{email_label}</FormLabel> 
                    <FormControl> 
                      <Input 
                        placeholder={email_placeholder} 
                        type="text" 
                        className="h-14 px-5 text-base rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground"
                        {...field}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !form.formState.isSubmitting) {
                            e.preventDefault();
                            form.handleSubmit(onSubmit)();
                          }
                        }}
                      />
                    </FormControl>
                    <FormError error={safeFormState.zodErrors?.identifier} />
                  </FormItem>
                )} 
              />
              <FormField 
                control={form.control} 
                name="password" 
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-base font-medium text-foreground">{password_label}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={password_placeholder} 
                        type="password" 
                        className="h-14 px-5 text-base rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground"
                        {...field}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !form.formState.isSubmitting) {
                            e.preventDefault();
                            form.handleSubmit(onSubmit)();
                          }
                        }}
                      />
                    </FormControl>
                    <FormError error={safeFormState.zodErrors?.password} />
                  </FormItem>
                )} 
              />
              <CardFooter className="flex flex-col items-center pt-6 px-0 space-y-2">
                <Button 
                  type="button"
                  variant="default"
                  className="btn-black"
                  disabled={form.formState.isSubmitting || isPending}
                  onClick={form.handleSubmit(onSubmit)}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    submit_button
                  )}
                </Button>

                {safeFormState.strapiErrors && (
                  <FormMessage className="text-destructive dark:text-destructive text-sm text-center">
                    {safeFormState.strapiErrors.message}
                  </FormMessage>
                )}
              </CardFooter>
            </div>
          </Form>
        </CardContent>
      </Card>
      {singupLink && (
        <p className="text-base text-muted-foreground text-center pt-4">
          {singup_previous_link_text}{" "}
          <Link href={singupLink.href} className="text-primary hover:underline font-medium">
            {singupLink.label}
          </Link>
        </p>
      )}
    </>
  );
}
