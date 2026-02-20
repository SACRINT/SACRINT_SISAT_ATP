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
                        };
                    }
                }

                // Try escuela (director)
                const escuela = await prisma.escuela.findUnique({ where: { email } });
                if (escuela) {
                    const valid = await bcrypt.compare(password, escuela.password);
                    if (valid) {
                        return {
                            id: escuela.id,
                            email: escuela.email,
                            name: escuela.nombre,
                            role: "director",
                            cct: escuela.cct,
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
                token.role = (user as any).role;
                token.cct = (user as any).cct;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.sub;
                (session.user as any).role = token.role;
                (session.user as any).cct = token.cct;
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
