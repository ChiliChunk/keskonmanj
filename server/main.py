from __future__ import annotations

import json
import mimetypes
import os
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

import generator
import sources

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

HOST = "0.0.0.0"
# 8799 est déjà pris par le service Garmin du dashboard sur la même Raspberry.
PORT = int(os.environ.get("KESKONMANJ_PORT", "8800"))

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data.json"
DIST_DIR = ROOT.parent / "dist"

# Les données vivent côté serveur (et non en IndexedDB comme le dashboard)
# pour que téléphone et PC voient les mêmes plats prévus et la même liste
# de courses.
_lock = threading.Lock()


DEFAULT_PANTRY = ["sel", "poivre", "huile", "eau"]
MAX_WEEKS = 8


def load_data() -> dict:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8")) if DATA_FILE.exists() else {}
    # Les clés ajoutées après coup sont complétées ici, pour qu'un data.json
    # d'une version précédente reste lisible sans migration.
    data.setdefault("dishes", [])
    data.setdefault("checked", [])
    data.setdefault("plan", {})
    data.setdefault("pantry", list(DEFAULT_PANTRY))
    data.setdefault("weeks", 1)
    data.setdefault("customTags", [])
    for dish in data["dishes"]:
        dish.setdefault("sources", [])
    return data


def forget_in_plan(data: dict, dish_id: str) -> None:
    data["plan"] = {slot: entry for slot, entry in data["plan"].items() if entry.get("dishId") != dish_id}


def clean_plan(raw: dict) -> dict:
    plan = {}
    for slot, entry in raw.items():
        if not isinstance(entry, dict):
            continue
        if entry.get("dishId"):
            plan[str(slot)] = {"dishId": str(entry["dishId"])}
        elif str(entry.get("text", "")).strip():
            plan[str(slot)] = {"text": str(entry["text"]).strip()}
    return plan


def save_data(data: dict) -> None:
    # Écriture atomique : un plantage en plein milieu ne doit pas laisser un
    # data.json tronqué, qui ferait perdre toute la bibliothèque.
    tmp = DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(DATA_FILE)


def clean_dish(raw: dict, dish_id: str) -> dict:
    ingredients = [
        {"name": str(i.get("name", "")).strip(), "quantity": str(i.get("quantity", "")).strip()}
        for i in raw.get("ingredients", [])
        if str(i.get("name", "")).strip()
    ]
    return {
        "id": dish_id,
        "name": str(raw.get("name", "")).strip() or "Sans nom",
        "description": str(raw.get("description", "")),
        "tags": [str(t) for t in raw.get("tags", [])],
        "servings": int(raw.get("servings") or 2),
        "prepMinutes": int(raw["prepMinutes"]) if raw.get("prepMinutes") else None,
        "ingredients": ingredients,
        "steps": [str(s) for s in raw.get("steps", []) if str(s).strip()],
        "source": "llm" if raw.get("source") == "llm" else "manual",
        "liked": bool(raw.get("liked")),
        "planned": bool(raw.get("planned")),
        "createdAt": str(raw.get("createdAt", "")),
        "sources": clean_sources(raw.get("sources") or []),
    }


def clean_sources(raw: list) -> list[dict]:
    def http(value: object) -> str | None:
        text = str(value or "")
        return text if text.startswith(("http://", "https://")) else None

    return [
        {"title": str(s.get("title") or s["url"]), "url": http(s.get("url")), "image": http(s.get("image"))}
        for s in raw
        if isinstance(s, dict) and http(s.get("url"))
    ]


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(length) or b"{}")

    def _segments(self) -> list[str]:
        return [s for s in urlparse(self.path).path.split("/") if s]

    def do_GET(self) -> None:
        segments = self._segments()
        if segments == ["api", "state"]:
            with _lock:
                self._send_json(200, load_data())
            return
        if segments[:1] == ["api"]:
            self._send_json(404, {"error": "Route inconnue."})
            return
        self._serve_static(segments)

    def do_POST(self) -> None:
        segments = self._segments()
        try:
            body = self._read_json()
            if segments == ["api", "generate"]:
                with _lock:
                    known = [d["name"] for d in load_data()["dishes"]]
                # Les plats déjà proposés puis écartés pendant la session
                # comptent aussi : sinon « Autre idée » renvoie souvent le
                # même plat pour les mêmes critères.
                known += [str(n) for n in body.get("recent", [])][-20:]
                dishes = generator.generate_dishes(
                    count=int(body.get("count") or 1),
                    tags=[str(t) for t in body.get("tags", [])],
                    note=str(body.get("note", "")),
                    servings=int(body.get("servings") or 2),
                    avoid=known,
                    ingredients=[str(i).strip() for i in body.get("ingredients", []) if str(i).strip()],
                    only_ingredients=bool(body.get("onlyIngredients")),
                )
                self._send_json(200, {"dishes": [clean_dish(d, uuid.uuid4().hex) for d in dishes]})
                return

            if segments == ["api", "sources"]:
                # Appel séparé de la génération : les recettes s'affichent tout
                # de suite, photos et liens arrivent quelques secondes après.
                self._send_json(200, {"sources": sources.find_sources(str(body.get("name", "")))})
                return

            if segments == ["api", "dishes"]:
                # L'id est attribué ici : crypto.randomUUID n'existe pas côté
                # navigateur hors contexte sécurisé, or l'app est servie en
                # HTTP simple sur le réseau local.
                dish_id = str(body.get("id") or uuid.uuid4().hex)
                dish = clean_dish(body, dish_id)
                with _lock:
                    data = load_data()
                    others = [d for d in data["dishes"] if d["id"] != dish_id]
                    # Un plat ni aimé ni prévu n'a plus de raison d'être gardé.
                    data["dishes"] = others + ([dish] if dish["liked"] or dish["planned"] else [])
                    if not dish["planned"]:
                        forget_in_plan(data, dish_id)
                    save_data(data)
                self._send_json(200, dish)
                return

            if segments == ["api", "checked"]:
                with _lock:
                    data = load_data()
                    data["checked"] = [str(c) for c in body.get("checked", [])]
                    save_data(data)
                self._send_json(200, {"checked": data["checked"]})
                return

            if segments == ["api", "plan"]:
                with _lock:
                    data = load_data()
                    data["plan"] = clean_plan(body.get("plan", {}))
                    data["weeks"] = max(1, min(MAX_WEEKS, int(body.get("weeks") or data["weeks"])))
                    save_data(data)
                self._send_json(200, {"plan": data["plan"], "weeks": data["weeks"]})
                return

            if segments == ["api", "tags"]:
                with _lock:
                    data = load_data()
                    data["customTags"] = [str(t).strip() for t in body.get("customTags", []) if str(t).strip()]
                    save_data(data)
                self._send_json(200, {"customTags": data["customTags"]})
                return

            if segments == ["api", "pantry"]:
                with _lock:
                    data = load_data()
                    data["pantry"] = [str(p).strip() for p in body.get("pantry", []) if str(p).strip()]
                    save_data(data)
                self._send_json(200, {"pantry": data["pantry"]})
                return

            self._send_json(404, {"error": "Route inconnue."})
        except generator.GenerationError as error:
            self._send_json(502, {"error": str(error)})
        except Exception as error:  # noqa: BLE001 — renvoyé tel quel au client local
            self._send_json(500, {"error": str(error)})

    def do_DELETE(self) -> None:
        segments = self._segments()
        if len(segments) == 3 and segments[:2] == ["api", "dishes"]:
            with _lock:
                data = load_data()
                data["dishes"] = [d for d in data["dishes"] if d["id"] != segments[2]]
                forget_in_plan(data, segments[2])
                save_data(data)
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"error": "Route inconnue."})

    def _serve_static(self, segments: list[str]) -> None:
        target = (DIST_DIR / "/".join(segments)).resolve()
        if not target.is_relative_to(DIST_DIR.resolve()) or not target.is_file():
            target = DIST_DIR / "index.html"
        if not target.is_file():
            self._send_json(404, {"error": "Front non construit : lancer `npm run build`."})
            return
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


def main() -> None:
    load_dotenv(ROOT / ".env")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "Erreur : ANTHROPIC_API_KEY doit être défini dans server/.env (voir .env.example).",
            file=sys.stderr,
        )
        sys.exit(1)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Keskonmanj à l'écoute sur http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
