import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Correo", type: "email" },
                password: { label: "Contraseña", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const email = credentials.email as string;
                const password = credentials.password as string;

                // Try admin first
                const admin = await prisma.admin.findUnique({ where: { email } });
                if (admin) {
                    const valid = await bcrypt.compare(password, admin.password);
                    if (valid) {
                        return {
                            id: admin.id,
                            email: admin.email,
                            name: admin.nombre,
                            role: "admin",
                            dbRole: admin.role,
                            permisos: admin.permisos,
                            organizacionId: admin.organizacionId || "zona004",
                        };
                    }
                }

                // Try escuela (director o supervision)
                const escuela = await prisma.escuela.findUnique({ where: { email } });
                if (escuela) {
                    const valid = await bcrypt.compare(password, escuela.password);
                    if (valid) {
                        try {
                            await prisma.escuela.update({
                                where: { id: escuela.id },
                                data: { ultimoIngreso: new Date() },
                            });
                        } catch (error) {
                            console.error("No se pudo actualizar ultimoIngreso:", error);
                        }

                        const userRole = escuela.esSupervision ? "supervision" : "director";

                        return {
                            id: escuela.id,
                            email: escuela.email,
                            name: escuela.nombre,
                            role: userRole,
                            dbRole: userRole,
                            cct: escuela.cct,
                            permisos: escuela.permisos,
                            organizacionId: escuela.zonaEscolar ? `zona${escuela.zonaEscolar.replace(/^0+/, '').padStart(3, '0')}` : "zona004",
                        };
                    }
                }

                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                const customUser = user as { role?: string; dbRole?: string; cct?: string; permisos?: unknown; organizacionId?: string };
                token.role = customUser.role;
                token.dbRole = customUser.dbRole;
                token.cct = customUser.cct;
                token.permisos = customUser.permisos;
                token.organizacionId = customUser.organizacionId;
            } else if (!token.organizacionId && token.sub) {
                // Auto-hidratación de sesiones previas en cookies
                try {
                    if (token.role === "admin") {
                        const admin = await prisma.admin.findUnique({
                            where: { id: token.sub },
                            select: { organizacionId: true },
                        });
                        token.organizacionId = admin?.organizacionId || "zona004";
                    } else {
                        const escuela = await prisma.escuela.findUnique({
                            where: { id: token.sub },
                            select: { zonaEscolar: true },
                        });
                        token.organizacionId = escuela?.zonaEscolar
                            ? `zona${escuela.zonaEscolar.replace(/^0+/, "").padStart(3, "0")}`
                            : "zona004";
                    }
                } catch (error) {
                    console.error("Error auto-hidratando organizacionId en jwt callback:", error);
                    token.organizacionId = "zona004";
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                const customSessionUser = session.user as { id?: string; role?: unknown; dbRole?: unknown; cct?: unknown; permisos?: unknown; organizacionId?: unknown; tenantId?: unknown };
                customSessionUser.id = token.sub;
                customSessionUser.role = token.role;
                customSessionUser.dbRole = token.dbRole;
                customSessionUser.cct = token.cct;
                customSessionUser.permisos = token.permisos;
                const orgId = token.organizacionId || "zona004";
                customSessionUser.organizacionId = orgId;
                customSessionUser.tenantId = orgId;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
});
