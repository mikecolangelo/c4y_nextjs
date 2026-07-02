"use client";
import { Input } from "@/components_shadcn/ui/input";
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components_shadcn/ui/card";
import { Form } from "@/components_shadcn/ui/form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components_shadcn/ui/form";
import Link from "next/link";
import type { SingupFormData } from "@/validations/types";
import { actions } from "@/actions";
import { type FormState, SignUpFormSchema } from "@/validations/auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "./form-error";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

const INITIAL_STATE: FormState = {
  data: {
    fullName: "",
    username: "",
    email: "",
    password: "",
  },
  zodErrors: null,
  strapiErrors: undefined,
  success: false,
  isLoading: false,
  message: undefined,
};

export function SignUpForm({ data }: { readonly data: Readonly<SingupFormData> }) {
  // Hooks primero (reglas de React)
  const [formState, setFormState] = useState<FormState>(INITIAL_STATE);
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof SignUpFormSchema>>({
    defaultValues: INITIAL_STATE.data,
  });

  // Verificación de data después de los hooks
  if (!data) return null;

  const {
    header,
    fullname_label,
    fullname_placeholder,
    username_label,
    username_placeholder,
    email_label,
    email_placeholder,
    password_label,
    password_placeholder,
    submit_buton,
    singin_previous_link_text,
    singin_link,
  } = data;

  const singinLink = singin_link?.[0];

  async function onSubmit(values: z.infer<typeof SignUpFormSchema>) {
    const formData = new FormData();
    formData.append("fullName", values.fullName);
    formData.append("username", values.username);
    formData.append("email", values.email);
    formData.append("password", values.password);

    startTransition(async () => {
      try {
        const result = await actions.auth.registerUserAction(formState, formData);
        if (result) {
          if (result.redirectTo) {
            window.location.href = result.redirectTo;
            return;
          }
          setFormState(result);
        }
      } catch (error) {
        console.error("Registration error:", error);
        setFormState({
          ...INITIAL_STATE,
          strapiErrors: {
            status: 500,
            name: "Error",
            message: "Error inesperado al registrarse. Intente nuevamente.",
          },
        });
      }
    });
  }

  // Asegurar que formState siempre tenga un valor válido
  const safeFormState = formState || INITIAL_STATE;

  return (
    <>
      <Card className="w-full py-8 px-8">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-3xl font-bold text-center">{header.title}</CardTitle>
          <CardDescription className="text-base text-center">
            {header.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Form {...form}>
            <div className="space-y-6">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium text-foreground">
                    {fullname_label || "Nombre completo"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={fullname_placeholder || "Ingresa tu nombre completo"}
                      className="h-14 px-5 text-base rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormError error={safeFormState.zodErrors?.fullName} />
                </FormItem>
              )} />
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium text-foreground">
                    {username_label}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={username_placeholder}
                      className="h-14 px-5 text-base rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormError error={safeFormState.zodErrors?.username} />
                </FormItem>
              )} /> 
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium text-foreground">
                    {email_label}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={email_placeholder}
                      className="h-14 px-5 text-base rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormError error={safeFormState.zodErrors?.email} />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium text-foreground">
                    {password_label}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={password_placeholder}
                      className="h-14 px-5 text-base rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormError error={safeFormState.zodErrors?.password} />
                </FormItem>
              )} />
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
                    submit_buton
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
      {singinLink && (
        <p className="text-base text-muted-foreground text-center pt-4">
          {singin_previous_link_text}{" "}
          <Link href={singinLink.href} className="text-primary hover:underline font-medium">
            {singinLink.label}
          </Link>
        </p>
      )}
    </>
  );
}
