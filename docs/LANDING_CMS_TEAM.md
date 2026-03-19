# Landing CMS — admins, moderators, bootstrap

## Roles

| Role | Blog visibility | Site & article SEO | Comment queue | Manage team |
|------|-----------------|-------------------|---------------|-------------|
| **Admin** | Yes | Yes | Yes | Yes |
| **Moderator** | View only | No | Yes | No |

## Bootstrap admins (required first deploy)

Set **Supabase Edge Function** secret:

`LANDING_CMS_BOOTSTRAP_ADMIN_IDS` = comma-separated Supabase Auth user UUIDs (the same IDs as in the Auth dashboard).

Example:

```text
LANDING_CMS_BOOTSTRAP_ADMIN_IDS=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Those users are always **admins** until you remove them from this env var. They cannot be removed via the CMS UI.

If this is empty **and** no one is stored in KV as admin, **nobody** can use the CMS until you set bootstrap IDs and redeploy the function.

### You are the only admin but cannot sign in

Symptoms: email/password is accepted (or you see a long message with **your user id**), but you stay on the login screen.

That means **Supabase Auth worked**; **CMS access** did not. Fix:

1. Open **Supabase Dashboard** → **Authentication** → **Users** → select your user → copy **User UID** (UUID).
2. **Project Settings** → **Edge Functions** → **Secrets** → create or edit **`LANDING_CMS_BOOTSTRAP_ADMIN_IDS`** → value = that UUID (only the UUID, or comma-separated UUIDs with no spaces, e.g. `uuid-one,uuid-two`).
3. **Deploy** (or redeploy) the **`make-server-51d3ca8d`** function so the runtime loads the secret (if access still fails after saving, redeploy once).
4. Sign in again at `seo-admin.html`.

The admin page uses the same Supabase project as the app (`soqkgrfzluewpuiguypm` in the URL). Your account must exist **in that project**, not a fork or different Supabase project.

## Troubleshooting CMS login (`seo-admin.html`)

Signing in uses **two steps**: (1) Supabase Auth email/password, (2) Edge Function `GET …/landing-cms/me` must return `role: "admin"` or `"moderator"`.

**Checklist**

1. **Supabase project match** — [seo-admin.html](../seo-admin.html) embeds `SUPABASE_URL` and the anon key for a specific project (ref in the hostname, e.g. `*.supabase.co`). The user you create in the dashboard must be in **that same project**. If you use a different Supabase project, update the URL/key in `seo-admin.html` and redeploy the landing site.

2. **Bootstrap or Team** — After a successful password sign-in, if you see a message about **no CMS access**, your Auth user exists but has **no role**. Fix: add your Auth user UUID to `LANDING_CMS_BOOTSTRAP_ADMIN_IDS` (and redeploy the edge function if required), or have an existing admin add you under **Team**.

3. **Red text under the form** — That comes from Supabase Auth (wrong password, unconfirmed email, etc.), not from the CMS role check.

4. **“Could not verify CMS role”** — Network/CORS, wrong function URL, or edge function error. Confirm `make-server-51d3ca8d` is deployed and secrets are set for that project.

## Adding moderators and extra admins

1. The person must already have a SeaDays account (Supabase Auth user).
2. Sign in to [seo-admin.html](../seo-admin.html) as an **admin**.
3. Open **Team** → enter their **email** → choose **Moderator** or **Admin** → **Add or update**.

Email lookup scans up to 5,000 Auth users (paginated). For very large projects, use UUID via API instead.

## Edge function URL (important for `seo-admin.html`)

Browser and `fetch` must call **one** path segment for the function name, then the route **without** repeating `make-server-51d3ca8d`:

- Correct: `https://YOUR_PROJECT.supabase.co/functions/v1/make-server-51d3ca8d/landing-cms/me`
- Wrong (404): `…/make-server-51d3ca8d/make-server-51d3ca8d/landing-cms/me`

If `landing-cms/me` returns **404**, the deployed `make-server-51d3ca8d` build is missing those routes — **redeploy** the function from the repo that includes `landing-cms` in `index.ts`.

## API (for automation)

- `GET /make-server-51d3ca8d/landing-cms/me` — current role (full path as registered inside Hono; see URL note above for HTTP clients)
- `GET /make-server-51d3ca8d/landing-cms/members` — list team (admin only)
- `POST /make-server-51d3ca8d/landing-cms/members` — body `{ "email": "...", "role": "admin"|"moderator" }` or `{ "userId": "uuid", "role": "none" }` to remove (admin only; cannot remove bootstrap)

## Guest comments

Blog readers submit comments on article pages; they are **pending** until a moderator or admin **Approves** or **Rejects** in the **Comments** tab. Approved comments show **name + text** only (email is not published).

## Static blog pages

Toggling **Show on site** updates the API immediately. To update the static site on GitHub Pages, run the **Generate Static Blogs** workflow (or use **Publish to GitHub** in seo-admin — see below).

## Publish to GitHub (from CMS)

Admins see **Run publish workflow** on the **Blog** tab. It calls GitHub’s API to start `generate-blogs.yml` on the landing repository (regenerate pages + commit/push).

### One-time setup (Supabase Edge Function secrets)

1. **GitHub token** — Create a [fine-grained PAT](https://github.com/settings/tokens) or classic PAT with **`Actions: Read and write`** on the **landing repo only** (or classic: `workflow` scope for that repo).

2. In **Supabase → Project → Edge Functions → Secrets**, add:

| Secret | Example value |
|--------|----------------|
| `GITHUB_LANDING_DISPATCH_TOKEN` | `ghp_...` or fine-grained token |
| `GITHUB_LANDING_DISPATCH_REPO` | `your-org/seadays-landing` (owner/repo, no `https`) |

Optional:

| Secret | Default |
|--------|---------|
| `GITHUB_LANDING_WORKFLOW_FILE` | `generate-blogs.yml` |
| `GITHUB_LANDING_DISPATCH_REF` | `main` |

3. **Redeploy** the `make-server-51d3ca8d` function so secrets load.

4. In the landing repo, ensure **Settings → Actions → General → Workflow permissions** allows the workflow to push (e.g. “Read and write” for `GITHUB_TOKEN` in that workflow — already typical for your generate-blogs job).

Cooldown: the button cannot fire more than once every **90 seconds** (abuse protection).
