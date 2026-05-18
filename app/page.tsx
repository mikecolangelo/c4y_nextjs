import { redirect } from "next/navigation";

export const metadata = {
  title: "Car4You Panama - Sistema de Gestión",
  description: "Sistema de gestión de flota y facturación",
};

export default function Home() {
  redirect("/signin");
}
