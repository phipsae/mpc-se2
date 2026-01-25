import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token and provider to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
        
        // Store GitHub access token
        if (account.provider === "github") {
          token.githubAccessToken = account.access_token;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        provider: token.provider as string | undefined,
        githubAccessToken: token.githubAccessToken as string | undefined,
      };
    },
  },
});

// Type augmentation for session
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    provider?: string;
    githubAccessToken?: string;
  }
}
