import { ToolContext } from "../types";

/**
 * MCP `_meta` key carrying who the call is on behalf of.
 *
 * Caller identity travels in `_meta`, never in the tool's `arguments`, for one
 * reason: `arguments` are authored by the model. If `userId` were an argument, a
 * prompt-injected document could ask the model to pass someone else's id and read
 * their documents. `_meta` is set by the Tool Router from the request's JWT and is
 * never shown to the model, so there is nothing there for it to forge.
 */
export const CALLER_META_KEY = "nexa/caller";

/** The subset of ToolContext a first-party MCP server needs to enforce access. */
export interface CallerIdentity {
  userId?: string;
  businessUnit: string;
  department?: string;
  isAdmin: boolean;
}

export function callerMeta(ctx: ToolContext): Record<string, unknown> {
  const identity: CallerIdentity = {
    userId: ctx.userId,
    businessUnit: ctx.businessUnit,
    department: ctx.department,
    isAdmin: ctx.isAdmin
  };
  return { [CALLER_META_KEY]: identity };
}

/**
 * Read the caller out of an incoming request's `_meta`.
 *
 * Throws rather than defaulting: a first-party server that quietly ran with no
 * business unit would query across the whole holding company. An unauthenticated
 * call is a bug in the gateway, and it should fail loudly there.
 */
export function requireCaller(meta: unknown): CallerIdentity {
  const raw = (meta as Record<string, unknown> | undefined)?.[CALLER_META_KEY];
  const caller = raw as CallerIdentity | undefined;
  if (!caller || typeof caller.businessUnit !== "string" || !caller.businessUnit) {
    throw new Error("Tool call arrived without caller identity — refusing to execute");
  }
  return {
    userId: typeof caller.userId === "string" ? caller.userId : undefined,
    businessUnit: caller.businessUnit,
    department: typeof caller.department === "string" ? caller.department : undefined,
    isAdmin: caller.isAdmin === true
  };
}
