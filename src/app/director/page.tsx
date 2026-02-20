import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DirectorPortal from "./DirectorPortal";

export default async function DirectorPage() {
    const session = await auth();

    if (!session || (session.user as any)?.role !== "director") {
        redirect("/login");
    }

    const cct = (session.user as any)?.cct;
    if (!cct) redirect("/login");

    const escuela = await prisma.escuela.findUnique({
        where: { cct },
        include: {
            entregas: {
                include: { programa: true },
                orderBy: { programa: { orden: "asc" } },
            },
        },
    });

    if (!escuela) redirect("/login");

    const recursos = await prisma.recurso.findMany({
        include: { programa: true },
        orderBy: { createdAt: "desc" },
    });

    return (
        <DirectorPortal
            escuela={JSON.parse(JSON.stringify(escuela))}
            recursos={JSON.parse(JSON.stringify(recursos))}
        />
    );
}
