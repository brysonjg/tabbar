import os
import re
import sys
from pathlib import Path

INKSCAPE_COMMENT_RE = re.compile(
    r"\s*<!--*-->\s*\n?",
    flags=re.MULTILINE,
)


def _icons_root() -> Path:
    """
    Find the `icons/` directory regardless of the current working directory.

    Expected layout:
      icons/
        scripts/
          fcompress.py
    """
    script_path = Path(__file__).resolve()
    scripts_dir = script_path.parent
    if scripts_dir.name == "scripts":
        return scripts_dir.parent
    return scripts_dir


def update_files() -> None:
    icons_root = _icons_root()
    os.chdir(icons_root)

    script_path = Path(__file__).resolve()
    skip_dirs = {"scripts", ".git", "__pycache__"}

    for root, dirs, files in os.walk(icons_root, topdown=True):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]

        for filename in files:
            file_path = (Path(root) / filename).resolve()

            if file_path == script_path:
                continue

            # Only touch SVG sources; ignore scripts and other files.
            if file_path.suffix.lower() != ".svg":
                continue

            try:
                content = file_path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, PermissionError, OSError):
                continue

            new_content, count = INKSCAPE_COMMENT_RE.subn("", content)
            if count <= 0:
                continue

            try:
                file_path.write_text(new_content, encoding="utf-8")
            except (PermissionError, OSError):
                continue

            print(f"Updated: {file_path.relative_to(icons_root)}")


HELP_OPTS = {"-h", "--h", "--help"}


def _print_help() -> None:
    print(
        "Usage: python3 fcompress.py\n"
        "Cleans SVG files of their comments.\n"
        "Options:\n"
        "  -h, --h, --help    show this help message and exit"
    )


def main() -> None:
    if any(arg in HELP_OPTS for arg in sys.argv[1:]):
        _print_help()
        return
    update_files()

if __name__ == "__main__":
    main()
