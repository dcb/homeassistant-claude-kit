import { Icon } from "@iconify/react";
import { recipeImageUrl } from "../../lib/mealie";

interface Props {
  recipe: { id: string; image: string | null; name: string };
  baseUrl: string;
  variant?: "tiny" | "min" | "original";
  width: number;
  height: number;
  className?: string;
}

export function RecipeImage({ recipe, baseUrl, variant = "min", width, height, className }: Props) {
  const src = recipeImageUrl(baseUrl, recipe, variant);
  if (!src) {
    // Placeholder uses className sizing only — inline width/height would override
    // Tailwind's w-full and cause horizontal overflow.
    //
    // A darker-than-card fill (the card body is bg-white/5) gives the image slot
    // a visible boundary — otherwise an equal-color placeholder blends into the
    // card and reads as a different shape than photo cards. The icon marks it as
    // an (empty) image area.
    return (
      <div className={`grid place-items-center bg-black/25 text-white/25 ${className ?? ""}`}>
        <Icon icon="mdi:silverware-fork-knife" width={36} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={recipe.name}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}
