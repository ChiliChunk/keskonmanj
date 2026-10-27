import { useState } from "react";
import type { Dish, DishDraft } from "../domain/types";
import { DishCard, LikeButton } from "./DishCard";

interface Props {
  dishes: Dish[];
  onSave: (dish: DishDraft, patch?: Partial<Dish>) => Promise<Dish | null>;
}

export function LibraryView({ dishes, onSave }: Props) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = dishes
    .filter(
      (dish) =>
        !needle ||
        dish.name.toLowerCase().includes(needle) ||
        dish.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
        dish.ingredients.some((i) => i.name.toLowerCase().includes(needle)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  if (dishes.length === 0) {
    return <p className="empty">Aucun plat aimé pour l'instant. Clique sur ♡ pour en garder un.</p>;
  }

  return (
    <div className="stack">
      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Chercher un plat, un tag, un ingrédient…"
      />
      {visible.map((dish) => (
        <DishCard
          key={dish.id}
          dish={dish}
          onEdit={(patch) => onSave(dish, patch)}
          actions={
            <>
              <LikeButton dish={dish} onToggle={() => onSave(dish, { liked: !dish.liked })} />
              <button
                className={dish.planned ? "secondary on" : "secondary"}
                onClick={() => onSave(dish, { planned: !dish.planned })}
              >
                {dish.planned ? "✓ Prévu" : "Prévoir"}
              </button>
            </>
          }
        />
      ))}
      {visible.length === 0 && <p className="empty">Rien ne correspond.</p>}
    </div>
  );
}
