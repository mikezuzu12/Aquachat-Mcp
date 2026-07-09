import CredentialsProvider from "next-auth/providers/credentials";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data: user } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("email", credentials.email)
          .maybeSingle();

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );
        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.full_name,
          email: user.email,
          image: user.avatar_url,
          language: user.language || "en", // Add language
          avatar_emoji: user.avatar_emoji,
          bg_color: user.bg_color,
          about: user.about,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.language = user.language || "en";
        token.avatar_emoji = user.avatar_emoji;
        token.bg_color = user.bg_color;
        token.about = user.about;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id;
        session.user.language = token.language || "en";
        session.user.avatar_emoji = token.avatar_emoji;
        session.user.bg_color = token.bg_color;
        session.user.about = token.about;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const },
  secret: process.env.NEXTAUTH_SECRET,
};