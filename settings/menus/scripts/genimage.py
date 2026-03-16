#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{3}([0-9a-fA-F]{1}|[0-9a-fA-F]{3}|[0-9a-fA-F]{5})?$")


def _tool_dir() -> Path:
    return Path(__file__).resolve().parent


def _validate_color(value: str, name: str) -> str:
    if "{" in value or "}" in value:
        raise ValueError(f"{name}: must not contain '{{' or '}}'")
    if not HEX_COLOR_RE.match(value):
        raise ValueError(f"{name}: expected hex color like #fff or #ffffff, got: {value!r}")
    return value


def _validate_fname(value: str) -> str:
    if "{" in value or "}" in value:
        raise ValueError("fname: must not contain '{' or '}'")

    # Disallow path traversal / separators; only allow a plain filename.
    p = Path(value)
    if p.name != value or value in {"", ".", ".."}:
        raise ValueError(f"fname: expected a filename (no paths), got: {value!r}")
    if "/" in value or "\\" in value:
        raise ValueError(f"fname: expected a filename (no paths), got: {value!r}")
    if not value.lower().endswith(".svg"):
        raise ValueError(f"fname: expected a .svg filename, got: {value!r}")
    return value


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Generates a themed SVG asset from the local '.genimg-tmp' template."
    )
    parser.add_argument("fg", help="Foreground color (e.g. #ffffff)")
    parser.add_argument("bg", help="Background color (e.g. #1e1e1e)")
    parser.add_argument("tabc", help="Tab color")
    parser.add_argument(
        "acbar",
        help="Active tab / accent bar color (top color of active tab when focused)",
    )
    parser.add_argument("fname", help="Output filename (e.g. preview.svg)")
    args = parser.parse_args(argv)

    try:
        fg = _validate_color(args.fg, "fg")
        bg = _validate_color(args.bg, "bg")
        tabc = _validate_color(args.tabc, "tabc")
        acbar = _validate_color(args.acbar, "acbar")
        fname = _validate_fname(args.fname)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    tool_dir = _tool_dir()
    template_path = tool_dir / ".genimg-tmp"
    out_dir = tool_dir.parent / "theme_imgs"
    out_path = out_dir / fname

    try:
        template = template_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"error: missing template file: {template_path}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"error: failed reading template: {exc}", file=sys.stderr)
        return 1

    rendered = (
        template.replace("{fg}", fg)
        .replace("{bg}", bg)
        .replace("{acbarc}", acbar)
        .replace("{tabc}", tabc)
    )

    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path.write_text(rendered, encoding="utf-8")
    except OSError as exc:
        print(f"error: failed writing output: {exc}", file=sys.stderr)
        return 1

    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

