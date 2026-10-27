import { buildShoppingList } from "../domain/shopping";
import type { Dish } from "../domain/types";

interface Props {
  dishes: Dish[];
  checked: string[];
  onCheckedChange: (checked: string[]) => void;
}

export function ShoppingView({ dishes, checked, onCheckedChange }: Props) {
  const lines = buildShoppingList(dishes);
  const checkedSet = new Set(checked);
  const remaining = lines.filter((line) => !checkedSet.has(line.key)).length;

  function toggle(key: string) {
    onCheckedChange(checkedSet.has(key) ? checked.filter((k) => k !== key) : [...checked, key]);
  }

  if (lines.length === 0) {
    return <p className="empty">La liste se remplit dès qu'un plat est prévu.</p>;
  }

  return (
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
          return (
            <li key={line.key} className={done ? "done" : undefined}>
              <label>
                <input type="checkbox" checked={done} onChange={() => toggle(line.key)} />
                <span className="name">{line.name}</span>
                <span className="needs">
                  {line.needs
                    .map((need) => (need.quantity ? `${need.quantity} (${need.dish})` : need.dish))
                    .join(" + ")}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
