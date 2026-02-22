# Chat Index

Chat Index is a modern, desktop-style AI chat workspace for technical users who want a clean interface without giving up power.

The project focuses on integrated workflows: multi-chat tabs, strong retrieval/organization, model + shortcut customization, and local-first state.

## Design Direction

Chat Index follows a KDE-inspired approach to UI and UX:

- Keep the default interface clean and understandable.
- Expose advanced control when users need it.
- Favor keyboard and workspace efficiency, not only visual simplicity.
- Build features as connected tools, not isolated toggles.

In short: modern and minimal on the surface, powerful and composable underneath.

## What Is Implemented

### Parallel tab workflow

You can run multiple chats in parallel, switch contexts quickly, and reorder tabs directly in the tab bar.

### Index as the operations hub

A dedicated Index surface is used to search, reopen, rename, and purge stored conversations. This keeps long-term chat management separate from active composition.

### Integrated customization

Themes, fonts, model settings, and keyboard shortcuts are all available in-app and designed to shape both visual comfort and interaction speed.

### Versioned conversation backend

Conversation history is stored with a versioned/tree-capable data model. This supports iterative workflows where context may branch over time.

### Markdown + technical readability

Chats support markdown rendering, code highlighting, and copy actions for code blocks.

## Current Status (Important)

Chat Index is actively developed.

Current limitations to know before use:

- Some in-app documentation sections are still placeholders.
- Tree/version history is implemented at the data-model level; rich visual tree navigation is still evolving.
- Some advanced settings surfaces (for example keybindings) are currently raw/power-user oriented.

The README is written to reflect current behavior rather than final target state.

## Who It Is For

Chat Index is built for technical users who are not necessarily programmers: users who understand tools, workflows, and data organization, and want more control than typical linear chat interfaces.

## Run Locally

1. Clone this repository. (and make a openrouter acc and open the chungus.js file and insert your api key uder the coment `// ! Insert API key here`)
2. Start a static server from repo root.

```bash
python3 -m http.server 8080
```

3. Open the app.

```txt
http://localhost:8080/index.html
```

Note: opening via `file://` can work, but a local server is recommended for consistent behavior.

## Open Source Note

A dedicated contributor guide will be added separately. For now, this README is end-user and product-behavior focused.

## License

See:
- `.github/LICENSE.md`
- `.github/lgpl-2.1.md`
