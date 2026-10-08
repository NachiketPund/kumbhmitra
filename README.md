# KumbhMitra — Backend (Render deploy package)

This folder contains everything needed to deploy the KumbhMitra backend to Render.

```
kumbhmitra-deploy/
├── server/            ← backend source (root dir for Render)
│   ├── src/
│   ├── .env.example   ← template (copy to .env locally; never commit)
│   ├── README.md      ← backend docs + API reference
│   ├── package.json
│   ├── tsconfig.json
│   └── run-migrate.js
├── render.yaml        ← Render service config (auto-applied if detected)
└── Dockerfile         ← for Docker-based Render deploys
```

## Deploy to Render (5 steps)

1. **Push this folder to a new GitHub repo.**
   On your machine inside `kumbhmitra-deploy/`:
   ```bash
   git init
   git add .
   git commit -m "deploy kumbhmitra backend"
   git remote add origin https://github.com/YOUR-USER/kumbhmitra-backend.git
   git push -u main
   ```

2. **Render → New → Web Service** → connect GitHub → select repo.
   - Root directory: `server`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

3. **Add environment variables** in Render's Environment tab:

   | Variable | Where to get it |
   |----------|-----------------|
   | `DATABASE_URL` | Supabase → Project Settings → Database → Connection string |
   | `SUPABASE_JWT_SECRET` | Supabase → Project Settings → API → JWT Secret |
   | `SUPABASE_URL` | Supabase → Project Settings → API → URL |
   | `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public key |
   | `CORS_ORIGIN` | Your frontend URL (comma-separated, no `*`) |
   | `NODE_ENV` | `production` |

   ⚠️ Never put real secrets in the repo — set them in Render's dashboard only.

4. **Run the migration once**: Render → Shell → `npm run migrate`
   (The 4 migrations create the schema and seed demo places.)

5. **Verify**: open `https://your-service.onrender.com/api/health`
   → expect `{"success":true,...,"database":{"status":"connected"}}`

## Local testing

```bash
cd server
npm install
cp .env.example .env   # then fill in values
npm run dev            # dev server (tsx)
```

## Security checklist before going live

- [ ] Rotate `SUPABASE_JWT_SECRET` (it was visible in local dev)
- [ ] `CORS_ORIGIN` set to exact frontend origin(s) — not `*`
- [ ] `NODE_ENV=production` set in Render
- [ ] `.env` NOT committed (`.gitignore` blocks it)

## Need help

See `server/README.md` for the full API reference and troubleshooting.
