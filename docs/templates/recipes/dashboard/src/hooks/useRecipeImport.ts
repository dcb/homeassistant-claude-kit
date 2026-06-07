import { useCallback, useState } from "react";
import { useHass } from "@hakit/core";
import { uuidv4 } from "../lib/uuid";

interface PendingImport {
  startedAt: number;
  promise: Promise<ImportResponse>;
}

interface ImportResponseOk {
  ok: true;
  slug: string;
  name: string;
  provider: string;
  /** True if an image URL was supplied (explicit field or LLM-extracted). */
  imageRequested?: boolean;
  /** True if the image was fetched and attached to the recipe. */
  imageOk?: boolean;
  /** Short diagnostic when an image was requested but failed. */
  imageError?: string;
}
interface ImportResponseErr { ok: false; error: string; details?: unknown; slug?: string; }
type ImportResponse = ImportResponseOk | ImportResponseErr;

// Module-level: survives component unmount.
const registry = new Map<string, PendingImport>();
const subscribers = new Set<(r: { id: string; resp: ImportResponse }) => void>();

function notify(id: string, resp: ImportResponse) {
  registry.delete(id);
  subscribers.forEach((cb) => cb({ id, resp }));
}

export function subscribeImportResults(cb: (r: { id: string; resp: ImportResponse }) => void) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function useRecipeImport(): {
  submit: (args: { text: string; provider?: "claude" | "openai"; source_url?: string; image_url?: string }) => string;
  pendingIds: string[];
} {
  const connection = useHass((s) => s.connection);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const submit = useCallback((args: { text: string; provider?: "claude" | "openai"; source_url?: string; image_url?: string }) => {
    const id = uuidv4();
    if (!connection) {
      notify(id, { ok: false, error: "no_connection" });
      return id;
    }
    // Drop empty/undefined optional fields so the script's `default('')` paths apply cleanly.
    const service_data: Record<string, string> = { text: args.text };
    if (args.provider) service_data.provider = args.provider;
    if (args.source_url) service_data.source_url = args.source_url;
    if (args.image_url) service_data.image_url = args.image_url;

    const promise = connection.sendMessagePromise({
      type: "call_service",
      domain: "script",
      service: "recipe_import_from_text",
      service_data,
      return_response: true,
    } as never).then((raw: unknown) => {
      // Expected shape (validated): { context, response: { slug, name, provider } | { error, ... } }
      const resp = (raw as { response?: unknown })?.response as Record<string, unknown> | undefined;
      if (resp && typeof resp.slug === "string" && typeof resp.name === "string") {
        const ok: ImportResponseOk = {
          ok: true,
          slug: resp.slug,
          name: resp.name,
          provider: String(resp.provider ?? ""),
          imageRequested: Boolean(resp.image_requested),
          imageOk: Boolean(resp.image_ok),
          imageError: typeof resp.image_error === "string" ? resp.image_error : undefined,
        };
        notify(id, ok); return ok;
      }
      const errCode = typeof resp?.error === "string" ? resp.error : "unknown";
      const err: ImportResponseErr = { ok: false, error: errCode, details: resp?.details, slug: typeof resp?.slug === "string" ? resp.slug : undefined };
      notify(id, err); return err;
    }).catch((e: unknown): ImportResponse => {
      const err: ImportResponseErr = { ok: false, error: "ws_error", details: String(e) };
      notify(id, err); return err;
    });

    registry.set(id, { startedAt: Date.now(), promise });
    setPendingIds((p) => [...p, id]);
    promise.finally(() => setPendingIds((p) => p.filter((x) => x !== id)));
    return id;
  }, [connection]);

  return { submit, pendingIds };
}
