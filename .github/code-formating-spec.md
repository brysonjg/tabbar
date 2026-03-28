# Code Formatting Specification

This document tells contributors how to style their code so the project stays readable, maintainable, and consistent. AGENTS.md and CONTRIBUTING.md link to this guide, so keep it concise, accurate, and focused on the languages that the repository actually ships.

## Scope
- The primary stack is vanilla HTML, CSS, JavaScript, Python, SVG/XML, and Markdown.
- Avoid new frameworks, transpilers, or preprocessing steps unless a maintainer explicitly approves them; the goal is simple, browser-native assets.
- Small snippets in other languages (JSON, WASM, GLSL, etc.) are acceptable only when they are incidental to the feature and do not dominate the repository. Explain their purpose and keep them isolated so reviewers do not have to understand them to follow the core logic.
- No JavaScript frameworks, type systems, or compilers are allowed. The highest priority is a working vanilla experience that developers can inspect and run without a build step.

## General rules
1. Always use spaces for indentation. Tabs are prohibited.
2. Keep indentation levels to no more than four spaces. Prefer two spaces in markup and Markdown, four spaces in CSS/JavaScript/Python blocks.
3. Do not commit trailing whitespace, extra blank lines, or mixed line endings.
4. Library files that distribute minified/compressed code are the only exception to human-readable formatting; do not format or hand-edit those files.
5. Comments should explain *why* a block exists, not restate what the code already makes obvious. It may also *denote the location of a code segment*. Generaly it should be the human reading the code not the human reading the comments.
6. The project root should stay clean: keep licensing, documentation, and tooling files in their designated folders (e.g., `.github/`, `docs/`). Avoid dumping build artifacts or personal files in the root.
7. Python is the only language allowed for build/utility scripts; target the latest stable Python 3 release and keep dependencies minimal. Scripts may depend on external libraries only when the script itself bootstraps that dependency (e.g., installs it or vendors it) before use.

## HTML formatting
- Indent HTML with two spaces. Any embedded JavaScript still uses four spaces inside `<script>` elements, with the `<script>` tag itself indented two spaces. (they will be indented with a 2 space ofset from the html document)
- Use multiline formatting for elements with children or content that would otherwise exceed about 120 characters. Single-line form is fine for self-closing or empty elements.
- Keep `<!DOCTYPE html>` uppercase and at the very top. Do not indent the document root (`<html>`, `<head>`, `<body>`), but indent their interior contents.
- Do not introduce blank lines between a `<style>` tag and its opening content; however, `<script>` tags should always contain a blank line before and after their JavaScript to visually separate it from markup.
- Close every tag explicitly (no optional closing). When listing attributes, wrap the tag across multiple lines if it improves readability.

## CSS formatting
- Indent selectors and declarations with four spaces. Blank lines should separate logical blocks of selector groups.
- List selectors with either all on one line (`selector, selector, selector`) or one per line with the comma trailing each line except the last. Keep the opening brace on the same line as the last selector.
- There must be exactly one space between selectors and the opening brace; there are no blank lines between selectors and `{`.
- Keep each rule set within 50 lines. If a selector’s declarations grow beyond that, consider splitting it into smaller, more specific pieces.
- Prefer CSS variables (`--fg-color`, `--component-border-radius`, etc.) over hardcoded colors. Name variables descriptively but keep them concise (up to five hyphen-separated words). When a variable represents a theme state, append `-1` for default, `-2` for hover, and `-3` for active if you are managing three discrete states.
- Use filters on image backgrounds only when they will later be controlled by theme variables. Keep filter logic centralized so a theme can override it without touching many files.

## JavaScript formatting
- Prefer `const` for value bindings and fall back to `let` only when reassignment is necessary. Never use `var`.
- Arrow functions must always include parentheses: `(event) => { ... }` even for single-argument signatures.
- Global helpers (top-level `const`/`let` declarations, `function` statements, `addEventListener` attachments, immediate-run arrow expressions like `(() => {})()`, and `window.onload = …`) should be the only things visible when the file is fully folded in an editor.
- Favor array iteration helpers (`array.forEach(...)`) over explicit `for` loops when iterating a known array. Numeric loops are acceptable for ranged iteration, but readability is the main goal.
- Use `document.querySelector(...)` instead of `document.getElementById(...)` for consistency with CSS selectors.
- Avoid deeply nested `try`/`catch` blocks (or any other error checking metheds). If you must check for a DOM node, prefer a guard clause (`if (!thing) return;`) over wrapping the remaining logic in an `if` block.
- Always include semicolons at line endings. Omitting them is considered a syntax violation.
- When attaching event listeners, omit the third `options` argument unless you specifically need capturing or passive behavior; do not supply `false`, `null`, or empty objects—simply call `.addEventListener(type, handler)`.
- Use the ternary operator only for expressions that comfortably fit on a single line (typically when rendering short values in template strings).
- Generate unique identifiers with sufficient entropy so that collisions are astronomically unlikely; document their format if they are referenced elsewhere.
- Think about future extensibility: structure your code so new features can be added without massive rewrites.

## Python formatting
- Follow [PEP 8](https://peps.python.org/pep-0008/) with line lengths capped at 88 characters and four-space indentation.
- Keep helper functions short and descriptive. Use docstrings for public functions and modules.
- Avoid unused imports, and run `python -m compileall` before committing to catch syntax errors early.

## SVG/XML formatting
- Treat SVG/XML like HTML: two-space indentation, explicit closing tags, and attributes aligned for readability.
- Keep `viewBox`, `width`, and `height` attributes ordered consistently (e.g., `viewBox`, then `width`, then `height`).
- Do not inline JavaScript inside SVGs unless it is absolutely necessary, and keep it limited to a few lines.
- Do not insert Animations into the SVGs if posible.

## Markdown formatting
- Use two-space indentation for code fences inside Markdown. Always specify the language (e.g., ```` ```html ````).
- Keep headings hierarchical and descriptive. Avoid overly long sentences in documentation; split ideas into paragraphs or lists.
- Run `markdownlint` (or the project’s preferred linter) before submitting large textual changes.

Keeping this guide clear helps reviewers verify formatting quickly, so please update it whenever formatting conventions change and mention the change at the top of AGENTS.md and CONTRIBUTING.md as well.
