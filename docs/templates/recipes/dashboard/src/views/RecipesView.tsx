import { useState } from "react";
import { LibrarySection } from "../components/recipes/LibrarySection";
import { RecipeDetailSection } from "../components/recipes/RecipeDetailSection";
import { CookModeSection } from "../components/recipes/CookModeSection";
import { MealPlanSection } from "../components/recipes/MealPlanSection";
import { ShoppingListSection } from "../components/recipes/ShoppingListSection";
import { ImportSection } from "../components/recipes/ImportSection";
import type { RecipesSection } from "./recipes-constants";

export function RecipesView() {
  const [section, setSection] = useState<RecipesSection>({ kind: "library" });

  if (section.kind === "library") {
    return (
      <LibrarySection
        onOpen={(slug) => setSection({ kind: "detail", slug })}
        onImport={() => setSection({ kind: "import" })}
        onMealPlan={() => setSection({ kind: "mealplan" })}
        onShopping={() => setSection({ kind: "shopping" })}
      />
    );
  }
  if (section.kind === "detail") {
    return (
      <RecipeDetailSection
        slug={section.slug}
        onBack={() => setSection({ kind: "library" })}
        onCook={(slug) => setSection({ kind: "cook", slug })}
        reviewMode={section.reviewMode}
        onReviewComplete={() => setSection({ kind: "detail", slug: section.slug })}
      />
    );
  }
  if (section.kind === "cook") {
    return (
      <CookModeSection
        slug={section.slug}
        onExit={() => setSection({ kind: "detail", slug: section.slug })}
      />
    );
  }
  if (section.kind === "mealplan") {
    return <MealPlanSection onBack={() => setSection({ kind: "library" })} />;
  }
  if (section.kind === "shopping") {
    return <ShoppingListSection onBack={() => setSection({ kind: "library" })} />;
  }
  if (section.kind === "import") {
    return (
      <ImportSection
        onBack={() => setSection({ kind: "library" })}
        onImported={(slug) => setSection({ kind: "detail", slug, reviewMode: true })}
      />
    );
  }

  // Exhaustive check - this should never be reached if RecipesSection type is complete
  const exhaustive: never = section;
  throw new Error(`Unhandled section kind: ${exhaustive}`);
}
