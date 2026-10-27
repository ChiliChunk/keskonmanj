"""Liens et photos de recettes réelles proches d'un plat proposé.

Claude cherche sur le web (outil de recherche côté serveur) ; on récupère
ensuite nous-mêmes l'image d'aperçu (og:image) de chaque page trouvée, la
recherche ne renvoyant que des titres et des liens.
"""

from __future__ import annotations

import html
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

import anthropic

import generator

MAX_SOURCES = 4
# Plus de candidats que d'emplacements : certaines pages n'ont pas d'image
# d'aperçu ou refusent les robots.
CANDIDATES = 8

# Certains sites de recettes renvoient une page vide ou une erreur aux
# clients qui ne ressemblent pas à un navigateur.
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)

_META_IMAGE = re.compile(
    r"""<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>""",
    re.IGNORECASE,
)
_CONTENT = re.compile(r"""content\s*=\s*["']([^"']+)["']""", re.IGNORECASE)


def find_sources(dish_name: str) -> list[dict]:
    try:
        response = generator.get_client().messages.create(
            model=generator.MODEL,
            max_tokens=2000,
            output_config={"effort": "low"},
            tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 1}],
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Cherche sur le web des pages de recettes de « {dish_name} », "
                        "de préférence sur des sites de cuisine francophones. "
                        "Une seule recherche, puis réponds simplement OK."
                    ),
                }
            ],
        )
    except anthropic.APIError as error:
        raise generator.api_errors(error) from error

    # Les résultats sont lus directement dans les blocs de l'outil : pas
    # besoin de faire recopier les liens par le modèle (risque d'erreur).
    candidates: list[dict] = []
    for block in response.content:
        if block.type != "web_search_tool_result" or not isinstance(block.content, list):
            continue
        for result in block.content:
            url = getattr(result, "url", "")
            if url.startswith(("http://", "https://")) and all(c["url"] != url for c in candidates):
                candidates.append({"title": getattr(result, "title", "") or url, "url": url})

    candidates = candidates[:CANDIDATES]
    with ThreadPoolExecutor(max_workers=len(candidates) or 1) as pool:
        images = list(pool.map(lambda c: preview_image(c["url"]), candidates))

    with_image = [dict(c, image=img) for c, img in zip(candidates, images) if img]
    without_image = [dict(c, image=None) for c, img in zip(candidates, images) if not img]
    return (with_image + without_image)[:MAX_SOURCES]


def preview_image(url: str) -> str | None:
    try:
        request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
        with urlopen(request, timeout=6) as response:
            # L'en-tête <head> suffit : inutile de télécharger toute la page.
            page = response.read(400_000).decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001 — une page injoignable n'a simplement pas d'image
        return None

    for tag in _META_IMAGE.findall(page):
        match = _CONTENT.search(tag)
        if match:
            image = urljoin(url, html.unescape(match.group(1).strip()))
            if urlparse(image).scheme in ("http", "https"):
                return image
    return None
