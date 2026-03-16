#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from shutil import which


def _icons_root() -> Path:
    """
    Find the `icons/` directory regardless of the current working directory.

    Expected layout:
      icons/
        scripts/
          scour.py
    """
    script_path = Path(__file__).resolve()
    scripts_dir = script_path.parent
    if scripts_dir.name == "scripts":
        return scripts_dir.parent
    return scripts_dir


def _iter_svg_files(root: Path, *, script_path: Path) -> list[Path]:
    skip_dirs = {"scripts", ".git", "__pycache__"}
    results: list[Path] = []

    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        dirnames[:] = [
            d for d in dirnames if d not in skip_dirs and not d.startswith(".")
        ]
        for name in filenames:
            path = (Path(dirpath) / name).resolve()
            if path == script_path:
                continue
            suffix = path.suffix.lower()
            if suffix not in {".svg", ".svgz"}:
                continue
            results.append(path)

    return results


def _scour_one(file_path: Path) -> None:
    file_dir = file_path.parent
    prefix = f".{file_path.name}.scour."

    fd, tmp_path_str = tempfile.mkstemp(prefix=prefix, dir=str(file_dir))
    os.close(fd)
    tmp_path = Path(tmp_path_str)

    try:
        subprocess.run(
            ["scour", str(file_path), str(tmp_path)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        tmp_path.replace(file_path)
        print(f"scoured: {file_path}")
    except subprocess.CalledProcessError as exc:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        err = (exc.stderr or "").strip()
        if err:
            print(err, file=sys.stderr)
        raise RuntimeError(f"error: scour failed for: {file_path}") from exc


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Run scour over SVG files.")
    parser.add_argument(
        "root",
        nargs="?",
        default=None,
        help="Root folder to scan (default: icons/ next to this script)",
    )
    args = parser.parse_args(argv)

    if which("scour") is None:
        print("error: 'scour' not found in PATH", file=sys.stderr)
        return 127

    icons_root = _icons_root()
    os.chdir(icons_root)

    script_path = Path(__file__).resolve()
    root = Path(args.root).resolve() if args.root is not None else icons_root

    for file_path in _iter_svg_files(root, script_path=script_path):
        _scour_one(file_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

