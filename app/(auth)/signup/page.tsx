import { SignUpForm } from "@/components/ui/sign-up-form";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Regístrate",
  description: "Ingresa tus datos para crear una nueva cuenta",
};

export default function SingUpPage() {
  // Valores por defecto (sin dependencia de Strapi)
  const formData = {
    header: {
      title: "Regístrate",
      subtitle: "Ingresa tus datos para crear una nueva cuenta"
    },
    fullname_label: "Nombre completo",
    fullname_placeholder: "Ingresa tu nombre completo",
    username_label: "Usuario",
    username_placeholder: "Ingresa tu nombre de usuario",
    email_label: "Correo electrónico",
    email_placeholder: "Ingresa tu correo electrónico",
    password_label: "Contraseña",
    password_placeholder: "Ingresa tu contraseña",
    submit_buton: "Registrarse",
    singin_previous_link_text: "¿Ya tienes una cuenta?",
    singin_link: [{
      href: "/signin",
      label: "Iniciar Sesión",
      isExternal: false
    }]
  };

  return <SignUpForm data={formData} />;
}
