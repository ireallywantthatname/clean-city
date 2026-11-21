import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { userRoleValidator } from "./schema";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const sessionUserValidator = v.object({
  id: v.string(),
  email: v.string(),
  name: v.string(),
  role: userRoleValidator,
});

export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.union(
    v.object({
      token: v.string(),
      user: sessionUserValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
    if (!user) return null;

    const hash = await sha256Hex(args.password);
    if (user.passwordHash !== hash) return null;

    const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("sessions", {
      token,
      userId: user._id,
      expiresAt,
    });

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  },
});

export const signOut = mutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return null;
  },
});

export const getSession = query({
  args: {
    token: v.string(),
    now: v.number(),
  },
  returns: v.union(sessionUserValidator, v.null()),
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < args.now) return null;

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  },
});
