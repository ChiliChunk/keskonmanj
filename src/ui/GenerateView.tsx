import { useEffect, useRef, useState } from "react";
import { fetchSources, generateDishes } from "../data/api";
import { TAGS, type Dish, type DishDraft, type Source } from "../domain/types";
import { DishCard, LikeButton } from "./DishCard";

const MAX_COUNT = 5;

interface Props {
  dishes: Dish[];
  onSave: (dish: DishDraft, patch?: Partial<Dish>) => Promise<Dish | null>;
  onError: (message: string) => void;
  customTags: string[];
  onCustomTagsChange: (tags: string[]) => void;
}

export function GenerateView({ dishes, onSave, onError, customTags, onCustomTagsChange }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [servings, setServings] = useState(2);
  const [count, setCount] = useState(1);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState("");
  const [onlyIngredients, setOnlyIngredients] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [generated, setGenerated] = useState<Dish[]>([]);
  const [searching, setSearching] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Les recherches de photos se terminent après coup : elles doivent voir la
  // liste des plats enregistrés du moment, pas celle de leur lancement.
  const savedRef = useRef(dishes);
  savedRef.current = dishes;

  function toggleTag(tag: string) {
    setTags((previous) =>
      previous.includes(tag) ? previous.filter((t) => t !== tag) : [...previous, tag],
    );
  }

  function addCustomTag(tag: string) {
    const known = [...TAGS, ...customTags].find((t) => t.toLowerCase() === tag.toLowerCase());
    if (!known) onCustomTagsChange([...customTags, tag]);
    const name = known ?? tag;
    setTags((previous) => (previous.includes(name) ? previous : [...previous, name]));
  }

  function removeCustomTag(tag: string) {
    onCustomTagsChange(customTags.filter((t) => t !== tag));
    setTags((previous) => previous.filter((t) => t !== tag));
  }

  /** Accepte aussi une liste collée d'un coup (« courgette, feta, oeufs »). */
  function addIngredients(text: string) {
    const names = text
      .split(/[,;\n]/)
      .map((name) => name.trim())
      .filter(Boolean);
    setIngredients((previous) => [
      ...previous,
      ...names.filter((name) => !previous.some((p) => p.toLowerCase() === name.toLowerCase())),
    ]);
    setIngredientInput("");
  }

  function attachSources(id: string, sources: Source[]) {
    setGenerated((previous) => previous.map((d) => (d.id === id ? { ...d, sources } : d)));
    setSearching((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    // Plat aimé ou prévu avant l'arrivée des photos : on les lui ajoute.
    const saved = savedRef.current.find((d) => d.id === id);
    if (saved && sources.length) void onSave(saved, { sources });
  }

  async function generate() {
    // Ce qui reste tapé dans le champ compte aussi : sinon un ingrédient
    // saisi sans appuyer sur Entrée serait ignoré sans prévenir.
    const pending = ingredientInput.trim();
    const allIngredients = pending ? [...ingredients, pending] : ingredients;
    if (pending) addIngredients(pending);
    setLoading(true);
    try {
      const fresh = await generateDishes({
        count,
        tags,
        note,
        servings,
        ingredients: allIngredients,
        onlyIngredients: onlyIngredients && allIngredients.length > 0,
        recent,
      });
      setGenerated(fresh);
      setRecent((previous) => [...previous, ...fresh.map((d) => d.name)]);
      setSearching(new Set(fresh.map((d) => d.id)));
      for (const dish of fresh) {
        fetchSources(dish.name)
          .then((sources) => attachSources(dish.id, sources))
          .catch(() => attachSources(dish.id, []));
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function update(view: Dish, patch: Partial<Dish>) {
    const isSaved = dishes.some((d) => d.id === view.id);
    // Une simple retouche d'un plat ni aimé ni prévu reste locale : rien à
    // enregistrer tant qu'on ne le garde pas.
    if (!isSaved && !patch.liked && !patch.planned) {
      setGenerated((previous) => previous.map((d) => (d.id === view.id ? { ...d, ...patch } : d)));
      return;
    }
    const saved = await onSave({ ...view, createdAt: view.createdAt || new Date().toISOString() }, patch);
    if (saved) setGenerated((previous) => previous.map((d) => (d.id === saved.id ? saved : d)));
  }

  const buttonLabel = generated.length
    ? count > 1
      ? "Autres idées"
      : "Autre idée"
    : count > 1
      ? `Générer ${count} plats`
      : "Générer un plat";

  return (
    <div className="stack">
      <section className="card">
        <h2>Envie de quoi ?</h2>
        <TagPicker
          tags={tags}
          customTags={customTags}
          onToggle={toggleTag}
          onAdd={addCustomTag}
          onRemove={removeCustomTag}
        />

        <div className="field ingredients-field">
          <span>Ingrédients que j'ai déjà (optionnel)</span>
          <div className="tag-input">
            {ingredients.map((name) => (
              <span key={name} className="chip on removable">
                {name}
                <button
                  aria-label={`Retirer ${name}`}
                  onClick={() => setIngredients((previous) => previous.filter((p) => p !== name))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={ingredientInput}
              onChange={(e) => setIngredientInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === ",") && ingredientInput.trim()) {
                  e.preventDefault();
                  addIngredients(ingredientInput);
                } else if (e.key === "Backspace" && !ingredientInput && ingredients.length > 0) {
                  setIngredients((previous) => previous.slice(0, -1));
                }
              }}
              onBlur={() => ingredientInput.trim() && addIngredients(ingredientInput)}
              placeholder={ingredients.length ? "Ajouter…" : "ex. courgette, feta, oeufs — Entrée pour valider"}
            />
          </div>
          {ingredients.length > 0 && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={onlyIngredients}
                onChange={(e) => setOnlyIngredients(e.target.checked)}
              />
              Uniquement ces ingrédients (+ basiques du placard)
            </label>
          )}
        </div>

        <div className="row">
          <label className="field grow">
            <span>Précision (optionnel)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex. un plat qui se réchauffe bien"
            />
          </label>
          <label className="field">
            <span>Personnes</span>
            <input
              type="number"
              min={1}
              max={12}
              value={servings}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>

        <div className="generate-bar">
          <div className="field">
            <span>Combien de plats ?</span>
            <div className="stepper" role="group" aria-label="Nombre de plats">
              {Array.from({ length: MAX_COUNT }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={n === count ? "on" : undefined}
                  onClick={() => setCount(n)}
                  aria-pressed={n === count}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button className="primary big" onClick={generate} disabled={loading}>
            {loading ? "En cuisine…" : buttonLabel}
          </button>
        </div>
      </section>

      {loading && <KitchenLoader count={count} />}

      <div className={loading ? "stack fading" : "stack"}>
        {generated.map((dish) => {
          const view = dishes.find((d) => d.id === dish.id) ?? dish;
          return (
            <DishCard
              key={dish.id}
              dish={view}
              defaultOpen={generated.length === 1}
              sourcesLoading={searching.has(dish.id)}
              onEdit={(patch) => update(view, patch)}
              actions={
                <>
                  <LikeButton dish={view} onToggle={() => update(view, { liked: !view.liked })} />
                  <button
                    className={view.planned ? "secondary on" : "secondary"}
                    onClick={() => update(view, { planned: !view.planned })}
                  >
                    {view.planned ? "✓ Prévu" : "Prévoir"}
                  </button>
                </>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function TagPicker({
  tags,
  customTags,
  onToggle,
  onAdd,
  onRemove,
}: {
  tags: string[];
  customTags: string[];
  onToggle: (tag: string) => void;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const tag = draft.trim();
    if (tag) onAdd(tag);
    setDraft("");
    setAdding(false);
  }

  return (
    <ul className="chips">
      {TAGS.map((tag) => (
        <li key={tag}>
          <button
            className={tags.includes(tag) ? "chip on" : "chip"}
            onClick={() => onToggle(tag)}
            aria-pressed={tags.includes(tag)}
          >
            {tag}
          </button>
        </li>
      ))}
      {customTags.map((tag) => (
        <li key={tag} className={tags.includes(tag) ? "chip on custom" : "chip custom"}>
          <button className="chip-label" onClick={() => onToggle(tag)} aria-pressed={tags.includes(tag)}>
            {tag}
          </button>
          <button className="chip-remove" onClick={() => onRemove(tag)} aria-label={`Supprimer le tag ${tag}`}>
            ×
          </button>
        </li>
      ))}
      <li>
        {adding ? (
          <input
            className="chip-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={commit}
            placeholder="Nouveau tag"
          />
        ) : (
          <button className="chip add" onClick={() => setAdding(true)} aria-label="Ajouter un tag">
            +
          </button>
        )}
      </li>
    </ul>
  );
}

const KITCHEN_LINES = [
  "On fouille le frigo…",
  "Le chef aiguise ses couteaux…",
  "On épluche les idées…",
  "Ça mijote doucement…",
  "On goûte la sauce…",
  "On demande à mamie…",
  "Une pincée d'inspiration…",
  "On feuillette les vieux carnets…",
  "On dresse l'assiette…",
];

const KITCHEN_EMOJIS = ["🥕", "🧅", "🍅", "🧄", "🌶️", "🥔", "🍋", "🧀"];

function KitchenLoader({ count }: { count: number }) {
  const [tick, setTick] = useState(() => Math.floor(Math.random() * KITCHEN_LINES.length));

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="card kitchen-loader" role="status" aria-live="polite">
      <div className="pot" aria-hidden="true">
        <span className="ingredient">{KITCHEN_EMOJIS[tick % KITCHEN_EMOJIS.length]}</span>
        <span className="steam">
          <i />
          <i />
          <i />
        </span>
        <span className="pot-body">🍲</span>
      </div>
      <p key={tick} className="kitchen-line">
        {KITCHEN_LINES[tick % KITCHEN_LINES.length]}
      </p>
      <p className="meta">{count > 1 ? `${count} plats en préparation` : "Un plat en préparation"}</p>
    </div>
  );
}
