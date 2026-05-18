import { z } from "zod";

export const SignInFormSchema = z.object({
  identifier: z.string().min(3, "Ingresa correo o usuario (mín. 3 caracteres)"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const SignUpFormSchema = z.object({
  fullName: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres"),
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  email: z.string().email("Dirección de correo electrónico inválida"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
}).refine((data) => {
  return data.email.includes("@") && data.email.includes(".") && data.email.length > 5;
}, {
  path: ["email"],
  message: "El correo electrónico debe contener un @ y un .",
});

export type SignInFormValues = z.infer<typeof SignInFormSchema>;
export type SignUpFormValues = z.infer<typeof SignUpFormSchema>;

export type FormState = {
  success?: boolean;
  isLoading?: boolean;
  message?: string;
  data?: {
    identifier?: string;
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
  };
  strapiErrors?: {
    status: number;
    name: string;
    message: string;
    details?: Record<string, string[]>;
  };
  zodErrors?: {
    identifier?: string[];
    fullName?: string[];
    username?: string[];
    email?: string[];
    password?: string[];
  } | null,
};
