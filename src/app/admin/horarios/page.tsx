import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AdminHorariosClient from "./AdminHorariosClient";

export default async function AdminHorariosPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || (user?.role !== "admin" && user?.role !== "ATP_LECTOR" && user?.role !== "ATP_EDITOR" && user?.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const escuelas = await prisma.escuela.findMany({
    orderBy: { nombre: "asc" }
  });

  return <AdminHorariosClient escuelas={escuelas} />;
}
