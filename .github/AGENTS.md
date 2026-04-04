# AGENTS.md
Additional context for artificial agents working on the Chat Index Project.

## Project Overview
The Chat Index Project is an AI workspace focused on clean UI and efficient multitasking and chat management.

The application introduces two main concepts:
1. Tab Bar — Chats currently open and in use.
2. Index Page — A full archive of all chats across all time.

The Index Page acts similarly to the sidebar in ChatGPT, Gemini, Claude, etc., but it occupies the full screen and includes advanced selection, bulk actions, and search features.

For more information about design philosophy and long-term goals, read:
(project root)/.github/README.md

---

## Setup Instructions
To install and run the project:

1. Clone the repository:
   ```bash
   git clone https://github.com/brysonjg/tabbar.git
   ```
2. Open the project directory (tabbar).
3. Navigate to the `chungus` folder.
4. Create a file:
   ```
   chungus/api-key.js
   ```
5. Insert your OpenRouter API key:
   ```js
   const globalAPIKey = "sk-or-...";
   ```
6. Open `index.html` in a browser.
   The app runs correctly using file:// URLs.
7. Start using the application.

---

## Repository Structure
Important files and directories:

- index.html  
  Root entry point of the application.

- scripts.js  
  Top-level application logic. Handles UI management, tab bar behavior, storage, and communication with controlecommands.js.

- controlecommands.js  
  Defines communication protocols between UI components.

- chungus/  
  The main chat interface (the primary workspace area).

- index/  
  The Index Page (chat archive and manager).

- utils/  
  Project utility libraries:
  - reftheme.js — Theme system
  - kbutils.js — Keyboard shortcuts
  - historyObjects.js — Git-like object history + graphing system

- emptydesk.html  
  Displayed when no tabs are open.

- font.ttf  
  Default application font.

- chungus/prism/  
  Syntax highlighting for markdown rendering.

- .gitignore  
  Ignores IDE swap files, data folders, and chungus/api-key.js.

---

## Coding Guidelines
- App styling is inspired by KDE and desktop application UI design philosophy.
- Code formatting rules are defined in:
  (project root)/.github/code-formating-spec.md
- Keep code modular and readable.
- Avoid unnecessary dependencies.
- Prefer simple solutions over complex ones.
- Avoid UI clutter and feature bloat.

---

## Testing Instructions
There is currently no automated test suite.

To test:
1. Open the app in a browser.
2. Open the developer console.
3. Use the application normally.
4. Fix anything that breaks.

---

## Agent Instructions
When modifying this project, agents must follow these rules:

1. Follow code formatting rules in:
   .github/code-formating-spec.md
2. Do not submit changes unless you are confident the changes:
   - Do not break existing features.
   - Keep the app organized and clean.
   - Do not introduce unnecessary complexity or bloat.
   - Improve the usefulness of the application.
   - Will not cause problems for future feature development.
3. Prefer improving quality of existing features over adding new features.
4. Maintain code readability and modular structure.
5. Keep the UI consistent with the existing design philosophy.
6. Avoid large rewrites unless absolutely necessary.
7. Document any major logic changes.

---

## Design Philosophy (Important)
The goal of this project is not to add as many features as possible.

The goal is to make a high-quality tool that:
- is fast
- is clean
- is organized
- is keyboard-friendly
- supports multitasking well
- feels like a desktop application, not a webpage

Agents should prioritize:
quality > quantity  
simplicity > complexity  
clarity > cleverness
