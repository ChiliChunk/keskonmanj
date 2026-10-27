import { useState, type FormEvent, type ReactNode } from "react";
import { parseIngredientLines } from "../domain/shopping";
import type { Dish, Source } from "../domain/types";

interface Props {
  dish: Dish;
  /** Recette dépliée d'emblée (vue Générer) ou repliée (listes). */
  defaultOpen?: boolean;
  /** Photos et liens en cours de recherche sur le web. */
  sourcesLoading?: boolean;
  /** Absent : la recette n'est pas modifiable depuis cette vue. */
  onEdit?: (patch: Partial<Dish>) => void;
  actions: ReactNode;
}

export function DishCard({ dish, defaultOpen = false, sourcesLoading = false, onEdit, actions }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const hasDetails = dish.ingredients.length > 0 || dish.steps.length > 0;

  if (editing && onEdit) {
    return (
      <DishEditor
        dish={dish}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          onEdit(patch);
          setEditing(false);
          setOpen(true);
        }}
      />
    );
  }

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
        <div className="dish-actions">
          {onEdit && (
            <button className="icon-btn edit" onClick={() => setEditing(true)} title="Modifier la recette">
              ✎
            </button>
          )}
          {actions}
        </div>
      </div>

      {(sourcesLoading || dish.sources.length > 0) && (
        <SourceGallery sources={dish.sources} loading={sourcesLoading} />
      )}

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

function SourceGallery({ sources, loading }: { sources: Source[]; loading: boolean }) {
  // Une image qui ne charge pas (lien mort, site qui bloque l'affichage
  // ailleurs que chez lui) laisse place au simple lien plutôt qu'à un trou.
  const [broken, setBroken] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="sources" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="source skeleton" />
        ))}
        <span className="sources-hint">Recherche de photos sur le web…</span>
      </div>
    );
  }

  return (
    <div className="sources">
      {sources.map((source) => {
        const showImage = source.image && !broken.has(source.url);
        return (
          <a
            key={source.url}
            className={showImage ? "source" : "source no-image"}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title}
          >
            {showImage && (
              <img
                src={source.image ?? undefined}
                alt=""
                loading="lazy"
                // Sans référent, les sites qui bloquent le hotlinking
                // laissent généralement passer l'image.
                referrerPolicy="no-referrer"
                onError={() => setBroken((previous) => new Set(previous).add(source.url))}
              />
            )}
            <span className="source-text">
              <span className="source-title">{source.title}</span>
              <span className="source-site">{siteName(source.url)}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function DishEditor({
  dish,
  onSave,
  onCancel,
}: {
  dish: Dish;
  onSave: (patch: Partial<Dish>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(dish.name);
  const [description, setDescription] = useState(dish.description);
  const [prepMinutes, setPrepMinutes] = useState(dish.prepMinutes?.toString() ?? "");
  const [servings, setServings] = useState(dish.servings);
  const [ingredients, setIngredients] = useState(
    dish.ingredients.map((i) => (i.quantity ? `${i.name} : ${i.quantity}` : i.name)).join("\n"),
  );
  const [steps, setSteps] = useState(dish.steps.join("\n"));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      name: name.trim() || dish.name,
      description: description.trim(),
      prepMinutes: Number(prepMinutes) > 0 ? Number(prepMinutes) : null,
      servings: Math.max(1, servings),
      ingredients: parseIngredientLines(ingredients),
      steps: steps
        .split("\n")
        .map((step) => step.trim())
        .filter(Boolean),
    });
  }

  return (
    <form className="card dish-editor stack-sm" onSubmit={submit}>
      <h2>Modifier la recette</h2>
      <label className="field">
        <span>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="row tight">
        <label className="field">
          <span>Temps (min)</span>
          <input type="number" min={0} value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} />
        </label>
        <label className="field">
          <span>Personnes</span>
          <input
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || 1)}
          />
        </label>
      </div>
      <label className="field">
        <span>Ingrédients — un par ligne, quantité après « : »</span>
        <textarea rows={8} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
      </label>
      <label className="field">
        <span>Étapes — une par ligne</span>
        <textarea rows={8} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <div className="row tight">
        <button type="submit" className="primary">
          Enregistrer
        </button>
        <button type="button" className="link" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
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
