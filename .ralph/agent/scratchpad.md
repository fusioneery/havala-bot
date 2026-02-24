# Scratchpad

## Objective
Fix: "Халва работает только внутри бота" — mini-app shows error screen when opened as Telegram Mini App.

## Analysis
The mini-app checks `window.Telegram?.WebApp?.initData` to determine if the user is authenticated (opened inside Telegram). If `initData` is falsy, it shows the "NotInBotScreen" error.

**Root cause**: The `index.html` was missing the Telegram WebApp SDK script tag:
```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

Without this script, `window.Telegram` is `undefined` even inside Telegram, so the auth check always fails → user sees the error screen.

## Fix Applied
Added the SDK script tag to `packages/mini-app/index.html` in the `<head>`, before the font import. Verified build succeeds and the script tag appears in the production dist.
