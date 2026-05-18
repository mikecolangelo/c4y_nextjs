import { SignInForm } from "@/components/ui/sign-in-form";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description: "Ingresa tus datos para iniciar sesión en tu cuenta",
};

export default function SinginPage() {
  // Valores por defecto (sin dependencia de Strapi)
  const formData = {
    header: {
      title: "Iniciar Sesión",
      subtitle: "Ingresa tus datos para iniciar sesión en tu cuenta"
    },
    email_label: "Correo electrónico o usuario",
    email_placeholder: "Ingresa tu correo o nombre de usuario",
    password_label: "Contraseña",
    password_placeholder: "Ingresa tu contraseña",
    submit_button: "Iniciar Sesión",
    singup_previous_link_text: "¿No tienes una cuenta?",
    singup_link: [{
      href: "/signup",
      label: "Regístrate",
      isExternal: false
    }]
  };

  return <SignInForm data={formData} />;
}
