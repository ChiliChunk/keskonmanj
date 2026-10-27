import { useState, type ReactNode } from "react";
import type { Dish } from "../domain/types";

interface Props {
  dish: Dish;
  /** Recette dépliée d'emblée (vue Générer) ou repliée (listes). */
  defaultOpen?: boolean;
  actions: ReactNode;
}

export function DishCard({ dish, defaultOpen = false, actions }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const hasDetails = dish.ingredients.length > 0 || dish.steps.length > 0;

  return (
    <article className="card dish">
      <div className="dish-head">
        <div>
          <h3>{dish.name}</h3>
          <p className="meta">
            {dish.prepMinutes ? `${dish.prepMinutes} min · ` : ""}
            {dish.servings} pers.
            {dish.source === "manual" ? " · ajouté à la main" : ""}
          </p>
        </div>
        <div className="dish-actions">{actions}</div>
      </div>

      {dish.description && <p className="description">{dish.description}</p>}

      {dish.tags.length > 0 && (
        <ul className="chips small">
          {dish.tags.map((tag) => (
            <li key={tag} className="chip static">
              {tag}
            </li>
          ))}
        </ul>
      )}

      {hasDetails && (
        <button className="link" onClick={() => setOpen((o) => !o)}>
          {open ? "Masquer la recette" : "Voir la recette"}
        </button>
      )}

      {open && hasDetails && (
        <div className="recipe">
          {dish.ingredients.length > 0 && (
            <section>
              <h4>Ingrédients</h4>
              <ul>
                {dish.ingredients.map((ingredient, index) => (
                  <li key={index}>
                    {ingredient.name}
                    {ingredient.quantity && <span className="qty"> — {ingredient.quantity}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {dish.steps.length > 0 && (
            <section>
              <h4>Étapes</h4>
              <ol>
                {dish.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </article>
  );
}

export function LikeButton({ dish, onToggle }: { dish: Dish; onToggle: () => void }) {
  return (
    <button
      className={dish.liked ? "icon-btn on" : "icon-btn"}
      onClick={onToggle}
      title={dish.liked ? "Retirer des aimés" : "Aimer"}
      aria-pressed={dish.liked}
    >
      {dish.liked ? "♥" : "♡"}
    </button>
  );
}
