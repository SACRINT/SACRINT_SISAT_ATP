import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
    try {
        const { cicloId } = await request.json();
        const cookieStore = await cookies();

        if (!cicloId || cicloId === "default") {
            cookieStore.delete("selectedCicloId");
            return NextResponse.json({ success: true, cicloId: null });
        }

        // Store selectedCicloId in a cookie
        cookieStore.set("selectedCicloId", cicloId, {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict",
            maxAge: 60 * 60 * 24 * 365, // 1 year
        });

        return NextResponse.json({ success: true, cicloId });
    } catch (error: unknown) {
        console.error("Error setting selected cycle cookie:", error);
        return NextResponse.json({ error: "Error al seleccionar el ciclo escolar" }, { status: 500 });
    }
}
