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
                const customUser = user as { role?: string; dbRole?: string; cct?: string; permisos?: any };
                token.role = customUser.role;
                token.dbRole = customUser.dbRole;
                token.cct = customUser.cct;
                token.permisos = customUser.permisos;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                const customSessionUser = session.user as { id?: string; role?: unknown; dbRole?: unknown; cct?: unknown; permisos?: unknown };
                customSessionUser.id = token.sub;
                customSessionUser.role = token.role;
                customSessionUser.dbRole = token.dbRole;
                customSessionUser.cct = token.cct;
                customSessionUser.permisos = token.permisos;
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
