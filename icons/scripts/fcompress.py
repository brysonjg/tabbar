import argparse
import logging
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean SVG files of noisy Inkscape comments.")
    parser.add_argument(
        "target_dir",
        nargs="?",
        help="Directory to clean (defaults to the icons root).",
    )
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="INFO",
        help="Logging verbosity (default: INFO).",
    )
    return parser.parse_args()


def configure_logging(level: str) -> None:
    logging.basicConfig(level=getattr(logging, level), format="%(levelname)s: %(message)s")


def update_files(target_root: Path) -> int:
    target_root = target_root.resolve()
    script_path = Path(__file__).resolve()
    skip_dirs = {"scripts", ".git", "__pycache__"}
    updated_files = 0

    logging.info("Scanning %s for SVG files", target_root)

    for root, dirs, files in os.walk(target_root, topdown=True):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]

        for filename in files:
            file_path = (Path(root) / filename).resolve()

            if file_path == script_path:
                continue

            if file_path.suffix.lower() != ".svg":
                continue

            try:
                content = file_path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, PermissionError, OSError) as exc:
                logging.debug("Skipping %s (%s)", file_path, exc)
                continue

            new_content, count = INKSCAPE_COMMENT_RE.subn("", content)
            if count <= 0:
                continue

            try:
                file_path.write_text(new_content, encoding="utf-8")
            except (PermissionError, OSError) as exc:
                logging.warning("Failed to write %s (%s)", file_path, exc)
                continue

            updated_files += 1
            logging.info("Cleaned %s (%d comment block%s removed)",
                         file_path.relative_to(target_root),
                         count,
                         "" if count == 1 else "s")

    logging.info("Done scanning %s; %d file(s) updated", target_root, updated_files)
    return updated_files


def main() -> None:
    args = parse_args()
    configure_logging(args.log_level.upper())
    target_dir = Path(args.target_dir).resolve() if args.target_dir else _icons_root()
    update_files(target_dir)

if __name__ == "__main__":
    main()
