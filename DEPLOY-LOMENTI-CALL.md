# Lomenti Call · Notes and FAQ assistant

This one commit contains the public guide UI and a **ready-to-deploy, not yet deployed** private backend.
The GitHub Pages site cannot itself write a Google Sheet or securely hide an AI API key.

## What works as soon as GitHub Pages updates
- AI-shaped FAQ assistant under the memo: **local question matching** (RU/LV, basic typo tolerance) against the real \`FAQ_GROUPS\` from \`faq.js\`. It says when it cannot determine the answer and offers up to three original questions; it never invents an answer. Local search is explicitly labelled **not AI**.
- Call notes are retained in **sessionStorage**, so an accidental reload in the same tab restores the draft.
- **Save notes** explicitly creates a dated entry in the browser's local archive. It survives reloads in the same browser; shared-machine and clearing-browser-data risks remain. Export TXT and history TXT work offline.
- Once a private backend is connected, saving also writes to SQLite on the VPS, and "Server history" reads the shared archive. The user is told if remote save failed. Notes are never silently sent to external services.
- The user should record **anonymised business-only** notes; personal contact details must not go in the notes.

## What requires VPS setup
The API needs a private HTTPS hostname, with a reverse proxy forwarding to \`127.0.0.1:8769\`.
Do **not** put the API key, an AI key or note data in this public repository, in GitHub Pages JavaScript, or in logs.
Place the deployed checkout at \`/opt/lomenti-call\` and \`/var/lib/lomenti-call\` under a separate OS account.
Store secrets in root-owned \`/etc/lomenti-call.env\` (0600), for example:

\`\`\`sh
LOMENTI_HOST=127.0.0.1
LOMENTI_PORT=8769
LOMENTI_ALLOWED_ORIGIN=https://shyn1x.github.io
LOMENTI_NOTES_DB=/var/lib/lomenti-call/notes.sqlite3
LOMENTI_ACCESS_KEY=<random secret at least 24 characters, private>
OPENAI_API_KEY=<private AI API key, optional for local-only mode>
LOMENTI_AI_MODEL=gpt-4.1-mini
\`\`\`

Install the separate systemd unit from \`ops/lomenti-call.service\`, then add an HTTPS reverse proxy for \`/api/*\` to \`127.0.0.1:8769\` under a dedicated domain. Test \`GET /api/health\` with the \`X-Guide-Key\` header, \`POST /api/notes\`, and \`POST /api/ask\` before handing access to Valdis. No exposed unauthenticated public endpoints and no changes to TrendScanner.
Back up \`/var/lib/lomenti-call/notes.sqlite3\` securely and establish retention and access rules before real calls.

**AI behavior:** when \`OPENAI_API_KEY\` is configured, AI maps a misspelled/paraphrased RU/LV question to a single FAQ ID, or asks for clarification. The browser displays the **verbatim FAQ answer** (not model-generated sales claims), plus a source link. There is a small rate limit and the model never receives customer notes, but the question itself goes to the external AI provider. Do not type personal data into the AI question field.

There is no automatic VPS deployment in this commit: the existing runner belongs to TrendScanner and has not been repurposed.
