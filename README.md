# MS CodeForge — Vercel production package

Existing Flask + PostgreSQL company website, prepared for Vercel Functions, hosted PostgreSQL and Vercel Blob media storage.

## Included functionality

- Public homepage, products, product search and product detail pages
- Company information, news, contact enquiries and legal centre
- Protected admin login, product management, news management and contact inbox
- CSRF-protected forms, hashed administrator passwords, login attempt throttling
- Image validation and re-encoding before upload
- Security response headers and secure production cookie settings
- Existing uploaded images retained under `public/static/uploads/`

## 1. Before deployment

1. Rotate the previous `SECRET_KEY` and PostgreSQL password. The previous project archive included `.env`; do not reuse those credentials.
2. Create a GitHub repository and upload this project. `.env` is excluded by `.gitignore`.
3. Create a Vercel project from that repository.
4. Create a Vercel Blob store connected to the Vercel project. Its `BLOB_READ_WRITE_TOKEN` should be added to the project environment automatically.
5. Create a hosted PostgreSQL database through the Vercel Marketplace (for example, Neon). Use the provider's pooled connection string with SSL.

Vercel's current Flask integration detects the root `app.py` application. Static files are placed in `public/static/` and served at `/static/...`.

## 2. Vercel environment variables

Set these in Vercel → Project → Settings → Environment Variables for Production, Preview and Development as appropriate:

- `SECRET_KEY`: a newly generated random value of at least 32 characters
- `DATABASE_URL`: hosted PostgreSQL pooled connection string; use `postgresql+psycopg://...` and `sslmode=require`
- `COOKIE_SECURE`: `true`
- `FLASK_DEBUG`: `false`
- `BLOB_READ_WRITE_TOKEN`: provided by the connected Vercel Blob store

Do not put real values in GitHub or this README.

## 3. Database initialization

After the Vercel environment variables and hosted database are configured, initialize the schema once from a trusted local terminal with the Vercel environment pulled locally:

```bash
vercel env pull .env.local
```

Copy `.env.local` to `.env` only locally (never commit it), then run:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
flask --app app init-db
flask --app app create-admin
```

Use a unique administrator password of at least 12 characters. The `init-db` command creates missing tables, including the login-attempt table. Back up the database before running schema changes on a database containing data.

## 4. Deploy

Connect the Git repository to Vercel and deploy. The Flask application is exposed from the root `app.py`. Use Vercel's deployment logs to inspect build and runtime errors.

For local testing:

```bash
python app.py
```

Set `COOKIE_SECURE=false` locally when using plain `http://127.0.0.1:5000`. The production environment must use HTTPS and `COOKIE_SECURE=true`.

## 5. Product images and uploads

- The company logo, homepage hero image and current uploaded images are included in `public/static/`.
- New admin uploads are validated, decoded and re-encoded as WebP, then stored in Vercel Blob.
- The total Vercel Function request is limited to 4 MB; each image is limited to 2 MB. Select fewer/smaller screenshots if a multi-file upload exceeds the request limit.
- Create a **public** Vercel Blob store for product logos and screenshots because those images are intentionally visible to website visitors.
- Do not store private documents in this public media store.

## 6. Product downloads and external links

The product editor accepts HTTPS website and download URLs. Add the real product website, release page or direct download URL when you have it. The product page displays those links; it does not host, mirror, scan or verify the external file itself. Confirm that each supplied URL is stable and safe before publishing it.

## 7. Important production limitations

- This package is prepared for deployment but is not yet deployed or live-tested against your Vercel account, hosted PostgreSQL database or Blob store.
- No software can be guaranteed completely secure. This includes authentication, database, platform, dependencies and third-party services. Keep dependencies updated, use strong unique credentials, enable database backups, monitor logs and test recovery.
- The contact form stores enquiries in the database; it does not send email notifications. An email provider and verified sending domain are needed if you want automatic notifications.
- Legal pages are editable templates, not legal advice. Review the wording against actual company practices and Zambian law before publication.
- Run a staging deployment and test every route, login, upload, edit, delete, search, contact submission and external download before promoting to Production.

## 8. Local project contents

- `app.py`: Flask application and routes
- `templates/`: public, admin and legal HTML templates
- `public/static/`: CSS, logo, hero background and existing uploaded images
- `.env.example`: variable names only; no credentials
- `requirements.txt`: runtime dependencies
