import { useState } from "react";
import { buildShoppingList, ingredientKey, isInPantry } from "../domain/shopping";
import type { Dish } from "../domain/types";

interface Props {
  dishes: Dish[];
  checked: string[];
  onCheckedChange: (checked: string[]) => void;
  pantry: string[];
  onPantryChange: (pantry: string[]) => void;
}

export function ShoppingView({ dishes, checked, onCheckedChange, pantry, onPantryChange }: Props) {
  const [showHidden, setShowHidden] = useState(false);
  const all = buildShoppingList(dishes);
  const hidden = all.filter((line) => isInPantry(line.key, pantry));
  const lines = showHidden ? all : all.filter((line) => !isInPantry(line.key, pantry));
  const checkedSet = new Set(checked);
  const remaining = lines.filter((line) => !checkedSet.has(line.key)).length;

  function toggle(key: string) {
    onCheckedChange(checkedSet.has(key) ? checked.filter((k) => k !== key) : [...checked, key]);
  }

  return (
    <div className="stack">
      {all.length === 0 ? (
        <p className="empty">La liste se remplit dès qu'un plat est prévu.</p>
      ) : (
        <section className="card">
          <div className="row between">
            <h2>
              {remaining} ingrédient{remaining > 1 ? "s" : ""} à acheter
            </h2>
            {checked.length > 0 && (
              <button className="link" onClick={() => onCheckedChange([])}>
                Tout décocher
              </button>
            )}
          </div>
          <ul className="shopping">
            {lines.map((line) => {
              const done = checkedSet.has(line.key);
              const inPantry = isInPantry(line.key, pantry);
              return (
                <li key={line.key} className={[done && "done", inPantry && "in-pantry"].filter(Boolean).join(" ")}>
                  <label>
                    <input type="checkbox" checked={done} onChange={() => toggle(line.key)} />
                    <span className="name">{line.name}</span>
                    <span className="needs">
                      {line.needs
                        .map((need) => (need.quantity ? `${need.quantity} (${need.dish})` : need.dish))
                        .join(" + ")}
                    </span>
                  </label>
                  {!inPantry && (
                    <button
                      className="to-pantry"
                      title="Je l'ai toujours à la maison : ne plus l'afficher"
                      onClick={() => onPantryChange([...pantry, line.name])}
                    >
                      Toujours chez moi
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {hidden.length > 0 && (
            <button className="link hidden-toggle" onClick={() => setShowHidden((s) => !s)}>
              {showHidden
                ? "Masquer les ingrédients du placard"
                : `+ ${hidden.length} ingrédient${hidden.length > 1 ? "s" : ""} du placard masqué${hidden.length > 1 ? "s" : ""} (${hidden.map((l) => l.name).join(", ")})`}
            </button>
          )}
        </section>
      )}

      <PantryEditor pantry={pantry} onChange={onPantryChange} />
    </div>
  );
}

function PantryEditor({ pantry, onChange }: { pantry: string[]; onChange: (pantry: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const names = input
      .split(/[,;\n]/)
      .map((name) => name.trim())
      .filter(Boolean)
      .filter((name) => !pantry.some((p) => ingredientKey(p) === ingredientKey(name)));
    if (names.length) onChange([...pantry, ...names]);
    setInput("");
  }

  return (
    <section className="card">
      <h2>Toujours dans mon placard</h2>
      <p className="hint">
        Ces ingrédients ne sont pas affichés dans la liste de courses. « huile » couvre aussi
        « huile d'olive ».
      </p>
      <div className="tag-input">
        {pantry.map((name) => (
          <span key={name} className="chip on removable">
            {name}
            <button aria-label={`Retirer ${name}`} onClick={() => onChange(pantry.filter((p) => p !== name))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && input.trim()) {
              e.preventDefault();
              add();
            }
          }}
          onBlur={() => input.trim() && add()}
          placeholder="ex. sucre, farine, ail — Entrée pour valider"
        />
      </div>
    </section>
  );
}
