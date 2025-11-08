import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { auth } from "@/server/better-auth";

export const authRouter = createTRPCRouter({
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await auth.api.signOut({
      headers: ctx.headers,
    });
    return { success: true };
  }),
});

