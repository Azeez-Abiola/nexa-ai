# Connectors — Frontend Work Remaining

Backend is done and verified (`d0af7eb`, `2f1b071`). This is what the frontend still needs.

**The one blocker:** users cannot connect a Microsoft account, because nothing calls the
consent endpoint. Everything else here is polish.

---

## Already done — do not rebuild

Streaming connector activity is wired in [App.tsx](frontend/src/App.tsx) already:

| Piece | Where |
|---|---|
| `ToolActivity` interface + `Message.toolActivity` | [App.tsx:68](frontend/src/App.tsx#L68), [App.tsx:90](frontend/src/App.tsx#L90) |
| `activeToolCalls` state | [App.tsx:563](frontend/src/App.tsx#L563) |
| SSE handling for `toolCall` / `toolResult` | [App.tsx:2122](frontend/src/App.tsx#L2122) |
| Live "Searching the knowledge base…" pills | [App.tsx:4377](frontend/src/App.tsx#L4377) |
| Persisted "Checked" pills on the message | [App.tsx:4190](frontend/src/App.tsx#L4190) |
| Styles (`.message-tools-v2`, `.message-tool-pill-v2`) | [App.tsx:7318](frontend/src/App.tsx#L7318) |

⚠️ **One trap if you touch the SSE loop.** The `toolCall` / `toolResult` branches must stay
*above* `fullResponse = data.fullResponse || ""`. Tool events carry no `fullResponse`, so
falling through to that line resets the streamed text to `""` and the message blanks
mid-answer. Both branches end in `continue` for this reason.

---

## 1. Settings → Connectors page — **required**

Route: `/settings/connectors`. The backend SPA fallback
([index.ts:379](backend/src/index.ts#L379)) already serves `index.html` for it, so no
backend change is needed.

### Wiring it in

`App.tsx` has no `<Routes>` — it branches on `location.pathname` with boolean flags. Follow
the `isUserChatProfile` precedent exactly:

```tsx
// near App.tsx:603, alongside the other flags
const isConnectorSettings = location.pathname === "/settings/connectors";
```

Then render it the way `UserChatProfile` is rendered at [App.tsx:3814](frontend/src/App.tsx#L3814),
and add it to the `NEUTRAL_ROUTES` / brand-reset dependency arrays if it should not carry
business-unit branding.

Build it as its own component (`src/ConnectorSettings.tsx`) rather than inline —
`App.tsx` is already ~7,000 lines.

### What the page must show

Per connector, driven entirely by `GET /api/v1/connectors`:

```
┌────────────────────────────────────────────────────────────┐
│  Knowledge Base                                            │
│  Search the organization's approved internal documents.    │
│  ✓ Active · Runs inside Nexa                               │
│                                            (no button)     │
├────────────────────────────────────────────────────────────┤
│  Microsoft 365                                             │
│  Search and read your own OneDrive and SharePoint files.   │
│  ⚠ Sends file contents to Microsoft                        │
│  Not connected                            [ Connect ]      │
├────────────────────────────────────────────────────────────┤
│  Microsoft 365                                             │
│  ✓ Connected as adedamola@uacnplc.com                      │
│  ⚠ Sends file contents to Microsoft                        │
│                                        [ Disconnect ]      │
└────────────────────────────────────────────────────────────┘
```

Three states, and they are genuinely different — don't collapse them:

| `connected` | `needsReconnect` | Show |
|---|---|---|
| `true` | `false` | "Connected as {account.email}" + **Disconnect** |
| `false` | `true` | "Reconnect needed — {reconnectReason}" + **Reconnect** (same flow as Connect) |
| `false` | `false` | "Not connected" + **Connect** |

`requiresIdentity === null` (Knowledge Base) means there is nothing for the user to do —
render it as active with no button.

**`dataLeavesNetwork: true` must be visible on the card.** It is the residency answer a
holding company has to be able to give, and it is the whole reason the field is stored
rather than inferred. Don't bury it in a tooltip.

### Connect flow

```tsx
const { data } = await axios.get("/api/v1/connectors/microsoft/connect", {
  headers: { Authorization: `Bearer ${token}` },
});
window.location.href = data.url;   // full redirect, not a popup — see below
```

Full-page redirect, not a popup: Microsoft's consent screen sets `prompt=select_account`
and popups get blocked or lose the opener on mobile Safari. The backend redirects back to
this same page with the outcome in the query string.

A `503` here means the *server* is not configured, not that the user did anything wrong.
`detail` is only populated for admins — show it only if present.

### Handling the callback landing

The user returns to `/settings/connectors?connector=microsoft&status=…`. Read it with
`useSearchParams`, show a banner, then **strip the query params** (`navigate("/settings/connectors", { replace: true })`)
so a refresh doesn't re-show a stale banner.

| `status` | Message |
|---|---|
| `connected` | ✓ "Microsoft 365 connected as `{account}`." Refetch the list. |
| `declined` | "You cancelled the Microsoft sign-in. Nothing was connected." |
| `expired` | "That sign-in link expired. Please try again." (state is 10-minute TTL) |
| `invalid` | "Something went wrong with the sign-in. Please try again." |
| `failed` | "Microsoft sign-in could not be completed. Please try again, or contact IT if it keeps happening." |

`account` is only present on `connected`.

### Disconnect flow

```tsx
const { data } = await axios.delete("/api/v1/connectors/microsoft", {
  headers: { Authorization: `Bearer ${token}` },
});
// data.note explains that the Microsoft-side consent grant still exists
```

**Show `data.note` verbatim.** Deleting Nexa's copy stops Nexa using the account, but the
consent grant lives on in the user's Microsoft account until they remove it at
`myaccount.microsoft.com`. Users will assume "Disconnect" revoked everything. Letting them
believe that is the one thing this screen must not do.

Confirm before disconnecting — it is destructive (re-consent is required to undo).

---

## 2. Reconnect prompt in chat — recommended

When a Graph tool fails because the grant was revoked, the tool result already tells the
model to say so, and the failed pill renders struck-through. What's missing is a route to
the fix.

The `toolResult` SSE event carries `ok: false` and a `summary`. When a failed result's
connector is one that `requiresIdentity`, surface an inline link to
`/settings/connectors`. Otherwise the user is told "reconnect Microsoft 365 in your
settings" with no way to get there.

Cheapest version: if any `toolResult` arrives with `ok: false` and its `tool` starts with
`microsoft_365__`, show a one-line banner under the message with a link.

---

## 3. Admin connector console — recommended

Nothing in the frontend calls `/api/v1/admin/connectors` yet, so **Microsoft 365 cannot be
approved for a business unit without a direct DB write or a curl.** That gates the whole
feature going live, so it ranks close to the settings page in practice.

Belongs in [Admin.tsx](frontend/src/Admin.tsx). Per connector, per business unit:

- `approved` toggle — the gate that takes a connector live
- `enabled` toggle
- `writeEnabled` toggle — **must be disabled in the UI while `approved` is false**; the
  API returns `400` for that combination, and a control that reliably errors is worse than
  one that is visibly unavailable
- `adminOnly` toggle, `allowedDepartments` multi-select
- Read-only display: `tools[]` with each tool's `access` badge, `reachable`,
  `dataLeavesNetwork`, `requiresIdentity`

Super admins must pass `?businessUnit=` (name, label or slug — **not** `SUPERADMIN`); BU
admins are scoped automatically and can omit it.

Also worth surfacing: `connector_tool_call`, `connector_tool_denied`,
`connector_settings_changed`, `connector_identity_connected`,
`connector_identity_disconnected` are all live audit event types. The existing audit log
viewer will show them if its filter list is extended.

---

## API reference

Base URL comes from `axios.defaults.baseURL` ([main.tsx:8](frontend/src/main.tsx#L8)).
All authenticated calls use `Authorization: Bearer ${token}` with the token from
`localStorage.getItem("token")`.

### `GET /api/v1/connectors` — auth

```json
{
  "connectors": [
    {
      "connectorId": "microsoft_365",
      "label": "Microsoft 365",
      "description": "Search and read the employee's own OneDrive and SharePoint files…",
      "requiresIdentity": "microsoft",
      "dataLeavesNetwork": true,
      "connected": false,
      "account": null,
      "needsReconnect": false,
      "reconnectReason": null
    }
  ],
  "microsoft": { "available": true, "configurationGap": null }
}
```

`account` is `{ "email": "…", "name": "…" }` when a grant exists. `configurationGap` is
non-null only for admins, and only when server config is incomplete.

### `GET /api/v1/connectors/microsoft/connect` — auth
→ `200 { "url": "https://login.microsoftonline.com/…" }`
→ `503 { "error": "…", "detail": "Missing configuration: …" }` (`detail` admins only)

### `GET /api/v1/connectors/microsoft/callback` — no auth
Microsoft calls this. Redirects to
`{FRONTEND_URL}/settings/connectors?connector=microsoft&status=<connected|declined|expired|invalid|failed>[&account=<email>]`

### `DELETE /api/v1/connectors/microsoft` — auth
→ `200 { "disconnected": true, "note": "Nexa no longer holds access… visit myaccount.microsoft.com…" }`

### `GET /api/v1/admin/connectors?businessUnit=<bu>` — admin auth

```json
{
  "businessUnit": "UAC FOODS LIMITED",
  "connectors": [
    {
      "connectorId": "microsoft_365",
      "label": "Microsoft 365",
      "kind": "first_party",
      "transport": "in_memory",
      "dataLeavesNetwork": true,
      "requiresIdentity": "microsoft",
      "globallyEnabled": true,
      "settings": {
        "enabled": true, "writeEnabled": false, "approved": false,
        "allowedDepartments": [], "adminOnly": false
      },
      "tools": [
        { "name": "search_files", "description": "…", "access": "read" }
      ],
      "reachable": true
    }
  ]
}
```

`settings` is `null` when the business unit has no enablement row yet — the first PATCH
creates one, closed (disabled, unapproved, read-only).

### `PATCH /api/v1/admin/connectors/:connectorId` — admin auth

Body — all optional: `businessUnit`, `enabled`, `approved`, `writeEnabled`, `adminOnly`,
`allowedDepartments: string[]`

→ `200 { "connectorId", "businessUnit", "settings": { … } }`
→ `400` if `writeEnabled: true` while `approved` is false

### Streaming events (already handled)

```
{ "toolCall":   { "callId", "tool", "connector", "label" } }
{ "toolResult": { "callId", "tool", "ok", "summary", "durationMs" } }
{ "done": true, …, "toolActivity": [ … ] }
```

`toolActivity` also arrives on persisted assistant messages, so pills survive a reload.

---

## Not blocked on the frontend

Microsoft 365 will not work for anyone until the Entra app registration is updated. Worth
knowing so a working page isn't mistaken for a broken one:

1. `AZURE_CONNECTOR_CALLBACK_URL` registered as a second redirect URI alongside the SSO one
2. Delegated Graph permissions added: `Files.Read.All`, `Sites.Read.All`, `offline_access`
3. **`Sites.Read.All` requires tenant admin consent** — the real gate
4. `CONNECTOR_TOKEN_ENCRYPTION_KEY` set (`openssl rand -hex 32`)

Until 1–4 are done, the Microsoft connector is **absent from the `connectors` array
entirely** — not present-but-disabled. An unconfigured identity provider is filtered out
before the response is built ([registry.ts:206](backend/src/services/tools/registry.ts#L206)),
on the grounds that a missing server-side env var is not something an employee can act on.
`microsoft.available` reports `false` separately.

So build the page off `connectors` alone and let it render a one-card list in local
development. Use `microsoft.available` only for an admin-facing note ("Microsoft 365 is not
configured on this server — {configurationGap}"), not to decide whether to draw a card.
This is the state you will develop against, so don't treat an absent Microsoft card as a
bug in your code.
