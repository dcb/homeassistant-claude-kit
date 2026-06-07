import type { MealieRecipeStep } from "../../lib/mealie-types";

interface Props {
  steps: MealieRecipeStep[];
  activeIndex?: number;
  onActivate?: (i: number) => void;
}

export function StepList({ steps, activeIndex, onActivate }: Props) {
  return (
    <ol className="space-y-3">
      {steps.filter((s) => s.text.trim()).map((s, i) => (
        <li
          key={s.id ?? i}
          onClick={() => onActivate?.(i)}
          className={`p-3 rounded-xl cursor-pointer ${i === activeIndex ? "bg-blue-500/30" : "bg-white/5 hover:bg-white/10"}`}
        >
          <span className="text-white/40 mr-2">{i + 1}.</span>
          <span className="text-white">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}
