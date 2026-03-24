#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from shutil import rmtree, which


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
            path = Path(dirpath) / name
            if path.resolve(strict=False) == script_path:
                continue
            suffix = path.suffix.lower()
            if suffix not in {".svg", ".svgz"}:
                continue
            if not path.exists():
                print(f"warning: skipping missing SVG {path}", file=sys.stderr)
                continue
            results.append(path)

    return results


def _pip_install_scour(python_executable: str) -> None:
    cmd = [python_executable, "-m", "pip", "install", "--user", "scour"]
    result = subprocess.run(
        cmd,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        output = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(output or "pip install failed")


def _create_local_venv(script_dir: Path) -> Path:
    venv_dir = script_dir / ".venv"
    if not venv_dir.exists():
        print("creating local virtual environment (.venv)...", file=sys.stderr)
        subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
    return venv_dir


def _venv_bin_path(venv_dir: Path, binary: str) -> Path:
    bin_dir = venv_dir / ("Scripts" if os.name == "nt" else "bin")
    suffix = ".exe" if os.name == "nt" else ""
    return bin_dir / f"{binary}{suffix}"


def _install_scour_in_venv(venv_dir: Path) -> Path:
    pip_path = _venv_bin_path(venv_dir, "pip")
    scour_path = _venv_bin_path(venv_dir, "scour")
    try:
        subprocess.run(
            [str(pip_path), "install", "scour"],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        output = (exc.stderr or exc.stdout or "").strip()
        if output:
            print(output, file=sys.stderr)
        raise RuntimeError("error: failed to install scour in .venv") from exc
    if not scour_path.exists():
        raise RuntimeError("error: scour executable missing in .venv/bin")
    print(f"using local virtual environment at {venv_dir}", file=sys.stderr)
    return scour_path


def _install_scour_via_pip() -> None:
    """Install the `scour` package into the current Python user environment."""
    print("scour not found; installing via pip...", file=sys.stderr)
    _pip_install_scour(sys.executable)


def _ensure_local_venv_command(script_dir: Path) -> list[str]:
    venv_dir = _create_local_venv(script_dir)
    scour_path = _install_scour_in_venv(venv_dir)
    return [str(scour_path)]


def _cleanup_local_venv(script_dir: Path) -> None:
    venv_dir = script_dir / ".venv"
    if venv_dir.exists():
        rmtree(venv_dir, ignore_errors=True)


def _ensure_scour_command(script_dir: Path) -> list[str]:
    """
    Return the command to invoke scour, installing it if necessary.
    Falls back to a local `.venv` installation if the console script is not on PATH.
    """
    scour_path = which("scour")
    if scour_path is not None:
        return [scour_path]

    try:
        _install_scour_via_pip()
    except RuntimeError as exc:
        output = str(exc)
        if "externally-managed-environment" in output:
            return _ensure_local_venv_command(script_dir)
        raise

    scour_path = which("scour")
    if scour_path is not None:
        return [scour_path]

    return _ensure_local_venv_command(script_dir)


def _scour_one(file_path: Path, scour_cmd: list[str]) -> None:
    file_dir = file_path.parent
    prefix = f".{file_path.name}.scour."

    fd, tmp_path_str = tempfile.mkstemp(prefix=prefix, dir=str(file_dir))
    os.close(fd)
    tmp_path = Path(tmp_path_str)

    try:
        subprocess.run(
            [*scour_cmd, str(file_path), str(tmp_path)],
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

    script_path = Path(__file__).resolve()
    script_dir = script_path.parent
    try:
        scour_cmd = _ensure_scour_command(script_dir)
    except RuntimeError as exc:
        print(exc, file=sys.stderr)
        _cleanup_local_venv(script_dir)
        return 127

    icons_root = _icons_root()
    os.chdir(icons_root)

    root = Path(args.root).resolve() if args.root is not None else icons_root
    try:
        for file_path in _iter_svg_files(root, script_path=script_path):
            _scour_one(file_path, scour_cmd)
    finally:
        _cleanup_local_venv(script_dir)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
