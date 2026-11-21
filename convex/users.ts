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

export const listByRole = query({
  args: {
    role: userRoleValidator,
  },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      email: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .take(100);

    return users
      .map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const seedUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: userRoleValidator,
  },
  returns: v.object({
    id: v.id("users"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const passwordHash = await sha256Hex(args.password);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        role: args.role,
        passwordHash,
        updatedAt: Date.now(),
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("users", {
      email: normalizedEmail,
      name: args.name,
      role: args.role,
      passwordHash,
      updatedAt: Date.now(),
    });
    return { id, created: true };
  },
});
