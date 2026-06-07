import { useState } from "react";
import { useHass } from "@hakit/core";
import { useMealieClient } from "../../hooks/useMealieClient";
import type { MealieRecipe } from "../../lib/mealie-types";
import { uuidv4 } from "../../lib/uuid";
import { recipeImageUrl } from "../../lib/mealie";
import { migratePendingTimers } from "../../lib/recipeTimers";

export function ImportReviewForm({ recipe, onSaved, onCancel, onDeleted }: {
  recipe: MealieRecipe;
  onSaved: () => void;
  onCancel: () => void;
  /** Called after the recipe was successfully deleted. Parent should navigate away. */
  onDeleted?: () => void;
}) {
  const { client, baseUrl } = useMealieClient();
  const connection = useHass((s) => s.connection);
  const [name, setName] = useState(recipe.name);
  const [description, setDescription] = useState(recipe.description ?? "");
  const [deleting, setDeleting] = useState(false);
  const [yieldStr, setYield] = useState(recipe.recipeYield ?? "");
  const [servingsStr, setServingsStr] = useState(
    recipe.recipeServings != null ? String(recipe.recipeServings) : "",
  );
  const [ingredients, setIngredients] = useState(
    recipe.recipeIngredient.map((it) => it.display ?? it.originalText ?? it.note ?? "").join("\n"),
  );
  const [steps, setSteps] = useState(recipe.recipeInstructions.map((s) => s.text).join("\n\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [imageVersion, setImageVersion] = useState(0); // bumped after upload/fetch to bypass <img> cache

  async function save() {
    if (!client) return;
    setSaving(true);
    setError(null);
    try {
      // Mealie regenerates step ids on every PATCH, so the id we send here is
      // throwaway — cook-mode timers are keyed by step POSITION, not id (see
      // recipeTimers.ts). We still send an id because the schema wants one.
      const stepTexts = steps.split("\n\n").map((s) => s.trim()).filter(Boolean);
      const nextInstructions = stepTexts.map((text, i) => ({
        id: recipe.recipeInstructions[i]?.id ?? uuidv4(),
        text,
        title: null,
        summary: null,
        // REQUIRED on PATCH (snake_case despite GET returning camelCase). See note
        // on MealieRecipeStep — omitting this 500s with TypeError on Mealie's side.
        ingredient_references: [],
      }));

      // Fold LLM-imported pendingCookTimers into the durable cookTimers map and
      // prune any whose step position no longer exists — all index-keyed.
      const nextExtras = migratePendingTimers(recipe.extras, nextInstructions.length);

      // Preserve structured ingredient data (quantity/unit/food/note) for unchanged
      // lines — the textarea-based editor only sees display strings, so without
      // this the LLM's parsing would evaporate on the first save and scaling
      // would stop working. Position-based match: if the line text equals what
      // was at that position before, keep its structured fields.
      const ingredientLines = ingredients.split("\n").map((l) => l.trim()).filter(Boolean);
      const nextIngredients = ingredientLines.map((line, i) => {
        const prev = recipe.recipeIngredient[i];
        const prevDisplay = (prev?.display ?? prev?.originalText ?? prev?.note ?? "").trim();
        if (prev && prevDisplay === line) {
          return {
            display: prev.display ?? line,
            note: prev.note ?? line,
            originalText: prev.originalText ?? line,
            quantity: prev.quantity,
            unit: null,
            food: null,
          };
        }
        // Edited or new line — drop quantity, fall back to plain display.
        return {
          display: line,
          note: line,
          originalText: line,
          quantity: null,
          unit: null,
          food: null,
        };
      });

      const parsedServings = servingsStr.trim() ? Number(servingsStr) : null;

      await client.updateRecipe(recipe.slug, {
        name,
        description: description || null,
        recipeYield: yieldStr || null,
        recipeServings: Number.isFinite(parsedServings) && parsedServings! > 0 ? parsedServings : null,
        recipeIngredient: nextIngredients,
        recipeInstructions: nextInstructions,
        extras: nextExtras,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File) {
    if (!client) return;
    setUploading(true);
    setError(null);
    try {
      await client.uploadRecipeImage(recipe.slug, file);
      setImageVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  // Alternative to file upload: fetch an image from a URL server-side (HA script
  // → stdlib urllib, HTTP/1.1 → Mealie PUT), the same reliable path the importer
  // uses. Browser-side fetch-to-blob would hit CORS on most recipe CDNs.
  async function fetchImageFromUrl() {
    const url = imageUrlInput.trim();
    if (!connection || !url) return;
    setUrlFetching(true);
    setError(null);
    try {
      const raw = await connection.sendMessagePromise({
        type: "call_service",
        domain: "script",
        service: "recipe_image_from_url",
        service_data: { slug: recipe.slug, image_url: url },
        return_response: true,
      } as never);
      const resp = (raw as { response?: { ok?: boolean; error?: string } })?.response;
      if (resp?.ok) {
        setImageVersion((v) => v + 1);
        setImageUrlInput("");
      } else {
        setError(`Image fetch failed${resp?.error ? `: ${resp.error}` : ""}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUrlFetching(false);
    }
  }

  async function deleteRecipe() {
    if (!client || !onDeleted) return;
    // Native confirm is the same primitive used for Cook Mode exit elsewhere;
    // keep the friction visible but not jarring.
    if (!confirm(`Delete "${recipe.name}"?\n\nThis cannot be undone. Mealie removes the recipe, its image, and any timer attachments.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await client.deleteRecipe(recipe.slug);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  // After an upload/fetch the file exists at the media path even though our local
  // `recipe.image` hash is still stale/null — build the URL straight from the id
  // so the preview shows immediately (even for a recipe that had no prior image).
  // `imageVersion` busts the <img> cache. Before any upload, use the normal hashed URL.
  const displaySrc = imageVersion > 0
    ? `${baseUrl.replace(/\/$/, "")}/api/media/recipes/${recipe.id}/images/min-original.webp?v=${imageVersion}`
    : recipeImageUrl(baseUrl, recipe, "min");

  return (
    <div className="space-y-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recipe name"
        className="w-full bg-white/5 rounded-xl px-3 py-2 text-white text-xl outline-none focus:bg-white/10"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="w-full bg-white/5 rounded-xl px-3 py-2 text-white outline-none focus:bg-white/10"
      />
      <div className="flex gap-3 flex-wrap">
        <input
          value={yieldStr}
          onChange={(e) => setYield(e.target.value)}
          placeholder="Yield (e.g. 4 servings)"
          className="flex-1 min-w-56 bg-white/5 rounded-xl px-3 py-2 text-white outline-none focus:bg-white/10"
        />
        <input
          type="number"
          min={1}
          step={1}
          value={servingsStr}
          onChange={(e) => setServingsStr(e.target.value)}
          placeholder="Servings #"
          title="Numeric servings count — drives ingredient scaling in the recipe view."
          className="w-32 bg-white/5 rounded-xl px-3 py-2 text-white outline-none focus:bg-white/10"
        />
      </div>

      <div>
        <label className="block text-white/70 mb-1">Image</label>
        <div className="flex items-start gap-3">
          {displaySrc ? (
            <img
              src={displaySrc}
              alt={recipe.name}
              className="w-40 aspect-[16/10] object-cover rounded-xl bg-white/5"
            />
          ) : (
            <div className="w-40 aspect-[16/10] rounded-xl bg-white/5 grid place-items-center text-white/30">
              No image
            </div>
          )}
          <div className="flex flex-col gap-2 flex-1 min-w-56">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
                e.target.value = ""; // allow re-selecting the same file
              }}
              disabled={uploading || urlFetching}
              className="text-white/80 text-sm file:mr-3 file:bg-white/10 file:hover:bg-white/20 file:text-white file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:cursor-pointer"
            />
            {uploading && <span className="text-white/40 text-sm">Uploading…</span>}

            <div className="flex items-center gap-2 text-white/30 text-xs">
              <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void fetchImageFromUrl(); } }}
                placeholder="Paste image URL…"
                disabled={uploading || urlFetching}
                className="flex-1 min-w-0 bg-white/5 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-sm outline-none focus:bg-white/10"
              />
              <button
                onClick={() => void fetchImageFromUrl()}
                disabled={!imageUrlInput.trim() || uploading || urlFetching}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg px-3 py-1.5 text-sm whitespace-nowrap"
              >
                {urlFetching ? "Fetching…" : "Fetch"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-white/70 mb-1">Ingredients (one per line)</label>
        <textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          rows={12}
          className="w-full bg-white/5 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none focus:bg-white/10"
        />
      </div>
      <div>
        <label className="block text-white/70 mb-1">Steps (blank line between)</label>
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={16}
          className="w-full bg-white/5 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none focus:bg-white/10"
        />
      </div>
      {error && <div className="text-red-300">{error}</div>}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={saving || deleting}
          className="bg-blue-500 hover:bg-blue-400 disabled:opacity-30 text-white rounded-xl px-5 py-3"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={deleting}
          className="bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl px-5 py-3"
        >
          {saving || uploading || urlFetching ? "Close" : "Cancel"}
        </button>
        {onDeleted && (
          <button
            onClick={() => void deleteRecipe()}
            disabled={saving || deleting || uploading || urlFetching}
            className="ml-auto bg-red-500/20 hover:bg-red-500/40 text-red-200 hover:text-red-100 disabled:opacity-30 rounded-xl px-5 py-3"
            title="Permanently delete this recipe from Mealie"
          >
            {deleting ? "Deleting…" : "Delete recipe"}
          </button>
        )}
      </div>
    </div>
  );
}
