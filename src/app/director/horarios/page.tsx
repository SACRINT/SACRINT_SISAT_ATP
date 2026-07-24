import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import HorariosClient from "./HorariosClient";

export default async function DirectorHorariosPage() {
  const session = await auth();
  const user = session?.user as { role?: string; cct?: string } | undefined;

  if (!session || user?.role !== "director") {
    redirect("/login");
  }

  const cct = user?.cct;
  if (!cct) redirect("/login");

  const escuela = await prisma.escuela.findUnique({
    where: { cct }
  });

  if (!escuela) redirect("/login");

  const permisosEscuela = (escuela.permisos as any) || {};
  if (permisosEscuela.horariosDesactivado === true) {
    redirect("/director");
  }

  return <HorariosClient escuela={escuela} />;
}
