import { useEffect, useState } from "react";
import { useRecipeImport, subscribeImportResults } from "../../hooks/useRecipeImport";
import { useMealieClient } from "../../hooks/useMealieClient";
import { useEntityState } from "../../lib/useEntityState";
import { RECIPE_IMPORT_PROVIDER, RECIPE_IMPORT_TIMEOUT_SECONDS } from "../../lib/entities";

interface Props {
  onBack: () => void;
  onImported: (slug: string) => void;
}

export function ImportSection({ onBack, onImported }: Props) {
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const provider = (useEntityState(RECIPE_IMPORT_PROVIDER) ?? "claude") as "claude" | "openai";
  const timeoutSec = Math.max(10, Number.parseInt(useEntityState(RECIPE_IMPORT_TIMEOUT_SECONDS) ?? "30", 10) || 30);
  const { submit, pendingIds } = useRecipeImport();
  const { client } = useMealieClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageWarn, setImageWarn] = useState<{ slug: string; error: string } | null>(null);
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  // Subscribe to global import-result stream so toasts surface even if section unmounts/remounts.
  useEffect(() => {
    const unsub = subscribeImportResults(({ id, resp }) => {
      if (id !== activeId) return;
      if (resp.ok) {
        // Recipe imported. If an image was requested but didn't attach, hold on
        // this screen and surface why instead of silently landing on an imageless recipe.
        if (resp.imageRequested && !resp.imageOk) {
          setImageWarn({ slug: resp.slug, error: resp.imageError ?? "" });
        } else {
          onImported(resp.slug);
        }
      } else { setError(resp.error); }
      setActiveId(null);
    });
    return () => { unsub(); };
  }, [activeId, onImported]);

  // UI-side give-up timer for the text-paste (LLM) path.
  useEffect(() => {
    if (!activeId) return;
    const t = window.setTimeout(() => {
      setActiveId(null);
      setError("timeout_ui");
    }, timeoutSec * 1000);
    return () => clearTimeout(t);
  }, [activeId, timeoutSec]);

  function submitText() {
    if (!text.trim()) return;
    setError(null);
    setImageWarn(null);
    const id = submit({
      text,
      provider,
      source_url: sourceUrl || undefined,
      image_url: imageUrl.trim() || undefined,
    });
    setActiveId(id);
  }

  async function importFromUrl() {
    if (!client || !sourceUrl.trim()) return;
    setError(null);
    setIsImportingUrl(true);
    try {
      // Mealie scrapes JSON-LD / Schema.org. Returns the new slug as a string.
      const slug = await client.createRecipeFromUrl(sourceUrl.trim());
      onImported(typeof slug === "string" ? slug : String(slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsImportingUrl(false);
    }
  }

  const isBusy = !!activeId || isImportingUrl;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={onBack} className="text-white/60 underline">← Library</button>
        <h1 className="text-2xl text-white">Import recipe</h1>
        <span className="ml-auto text-white/40 text-sm">Provider: {provider}</span>
      </div>

      <label className="block text-white/70 mb-1">Recipe URL</label>
      <div className="flex gap-2 mb-1">
        <input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-white placeholder-white/40 outline-none focus:bg-white/10"
        />
        <button
          onClick={() => void importFromUrl()}
          disabled={!sourceUrl.trim() || isBusy}
          className="bg-blue-500 hover:bg-blue-400 disabled:opacity-30 text-white rounded-xl px-4 py-2 whitespace-nowrap"
          title="Import from URL — Mealie scrapes the page (no LLM, fast)"
        >
          {isImportingUrl ? "Importing…" : "Import URL"}
        </button>
      </div>
      <p className="text-white/40 text-xs mb-5">
        URL-only: Mealie scrapes structured recipe markup directly — fast, no LLM cost.
        Use the textarea below for unstructured text or content from a chat.
      </p>

      <label className="block text-white/70 mb-1">Pasted text</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a recipe (any format)..."
        rows={16}
        className="w-full bg-white/5 rounded-xl px-3 py-2 text-white placeholder-white/40 font-mono text-sm outline-none focus:bg-white/10"
      />

      <label className="block text-white/70 mb-1 mt-4">Image URL <span className="text-white/40">(optional)</span></label>
      <input
        type="url"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="https://...jpg — paste a direct link to the recipe photo"
        className="w-full bg-white/5 rounded-xl px-3 py-2 text-white placeholder-white/40 outline-none focus:bg-white/10"
      />
      <p className="text-white/40 text-xs mt-1">
        Direct image link is fetched and attached on import. Overrides any image URL found in the text above. Leave blank to skip.
      </p>

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button
          onClick={submitText}
          disabled={!text.trim() || isBusy}
          className="bg-blue-500 hover:bg-blue-400 disabled:opacity-30 text-white rounded-xl px-6 py-3"
        >
          {activeId ? "Importing…" : "Import text"}
        </button>
        {activeId && pendingIds.length > 0 && (
          <button onClick={() => setActiveId(null)} className="text-white/60 underline">Cancel</button>
        )}
      </div>

      {error === "timeout_ui" ? (
        <div className="mt-3 bg-yellow-500/10 text-yellow-200 rounded-xl p-3 text-sm">
          The import is still running in the background. Your recipe will appear in the Library shortly.{" "}
          <button onClick={onBack} className="underline">Go to Library</button>
        </div>
      ) : error ? (
        <div className="mt-3 text-red-300 text-sm">Failed: {error}. Try again or edit the input.</div>
      ) : imageWarn ? (
        <div className="mt-3 bg-yellow-500/10 text-yellow-200 rounded-xl p-3 text-sm">
          Recipe imported, but the image couldn’t be fetched
          {imageWarn.error ? <> (<span className="font-mono text-xs">{imageWarn.error}</span>)</> : null}.
          Check the image URL is a direct link to the photo, or add one in the recipe editor.{" "}
          <button onClick={() => onImported(imageWarn.slug)} className="underline">Open recipe</button>
        </div>
      ) : null}

      {activeId && (
        <p className="text-white/40 text-sm mt-2">
          The import keeps running in the background even if you navigate away — a notification will appear when it's done.
        </p>
      )}
    </div>
  );
}
