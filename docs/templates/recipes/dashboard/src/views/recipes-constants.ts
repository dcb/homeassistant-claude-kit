export type RecipesSection =
  | { kind: "library" }
  | { kind: "detail"; slug: string; reviewMode?: boolean }
  | { kind: "cook"; slug: string }
  | { kind: "mealplan" }
  | { kind: "shopping" }
  | { kind: "import" };
