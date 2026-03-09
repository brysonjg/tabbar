# Chat Index

Chat Index is a tabbed AI workspace for people who want to manage chats like actual work instead of disposable blobs in a sidebar.

It is built around a simple idea: AI chat tools should support parallel work, fast navigation, clean organization, and bulk management without making you click through five unrelated panels just to find or delete something.

The interface takes a lot of inspiration from traditional desktop workflows and KDE-style UI design. The result is a browser-hosted chat client that feels closer to a workspace than a toy.

## Why Use It

- Real tabs for parallel chats
- Fast switching between active conversations
- An index view for browsing and searching saved chats
- Bulk-style management tools for renaming, reopening, and purging chat history
- A cleaner, more desktop-like interface than the usual AI web app sludge
- Theming, fonts, keybindings, model selection, and account settings
- Chat history branching and version navigation

## What Makes It Different

Most AI chat interfaces treat conversation management like an afterthought.

Chat Index does not. The project is built around the part that usually wastes time:

- opening multiple conversations at once
- jumping between them quickly
- keeping titles readable
- finding older work again
- deleting junk without friction
- keeping the UI predictable and compact

If you regularly use AI for coding, writing, research, or troubleshooting, this is meant to reduce the annoying parts around the model itself.

## Current Stack

This project is intentionally simple:

- plain HTML, CSS, and JavaScript
- browser-hosted UI
- local storage for chat/session state
- OpenRouter for model access

There is no heavyweight framework requirement just to try it.

## Install And Start

Clone the repo:

```bash
git clone https://github.com/brysonjg/tabbar.git
cd tabbar/chungus
```

Create `./chungus/api-key.js` with your OpenRouter key:

```javascript
const gloablAPIKey = "sk-or-...";
```

You can use a free OpenRouter key if that is enough for your use case.
To get an OpenRouter key go to [openrouter.ai](https://openrouter.ai) and make an accout then
make a key and copy it into the file.

Then start the app in either of these ways:

1. Open `index.html` directly in the browser.
2. Serve the folder locally with a small HTTP server.

Using a local HTTP server is the better option.

Example:

```bash
python3 -m http.server
```

Then open the local URL shown by Python and start using the app.

## First Run

1. Open a new tab with the plus button or by double-clicking the tab bar.
2. Type a prompt into the chat input.
3. Press `Enter` or click the send button.
4. Use the index page to reopen, search, rename, or purge old chats.
5. Use settings to configure appearance, models, and keybindings.

If you get an error like `Error: HTTP 123`, check the in-app documentation and your OpenRouter configuration first.

## In-App Documentation

Use the documentation button in the top-right action area to open the built-in docs in a new tab.

## Who This Is For

This project is a good fit if you:

- keep many AI chats open at once
- want better organization than the default chat sidebar pattern
- like desktop-inspired interfaces
- want a local, hackable frontend instead of a sealed platform

## License

See:

- `.github/LICENSE.md`
- `.github/lgpl-2.1.md`
