import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account && account.provider === "google") {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: account.id_token,
            }),
            
          });
          
          if (!res.ok) {
            throw new Error("Failed to authenticate with backend");
          }

          const responseBody = await res.json();
          token.backendJwt = responseBody.data.token;
          token.user = responseBody.data.user;
        } catch (error) {
          console.error("Error exchanging token with backend:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.backendJwt) {
        session.backendJwt = token.backendJwt;
        session.user.id = token.user?._id;
        session.user.preferredLanguage = token.user?.preferredLanguage;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
