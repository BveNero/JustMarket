# JustMarket

Dark marketplace app powered by Supabase and ready for free static deployment.

## Stack

- Static frontend in [index.html](/Users/macbook/Desktop/company-marketplace/index.html), [styles.css](/Users/macbook/Desktop/company-marketplace/styles.css), and [app.js](/Users/macbook/Desktop/company-marketplace/app.js)
- Supabase Auth for account signup and login
- Supabase Postgres for listings, favorites, chats, and messages
- Free static hosting on Netlify

## Features

- Shared customer and company accounts
- Shared listings with image uploads
- Saved ads per user
- Buyer-seller chat threads tied to listings
- Search, filters, and category shortcuts
- No seeded demo users, fake posts, or fake chats

## One-Time Supabase Setup

1. Open the Supabase SQL Editor for your project.
2. Paste the contents of [supabase/setup.sql](/Users/macbook/Desktop/company-marketplace/supabase/setup.sql).
3. Run the SQL once.

Optional:
- If you want instant sign-up without email confirmation, change the email auth settings in Supabase so confirmation is not required.

## Local Preview

Do not open `index.html` with `file://`.

Serve the folder locally instead:

```bash
cd /Users/macbook/Desktop/company-marketplace
python3 -m http.server 8000
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Free Deploy

This repo is ready for free static deployment on Netlify.

1. Sign in to Netlify with GitHub.
2. Import the GitHub repo `BveNero/JustMarket`.
3. Keep the publish directory as `.`.
4. Leave the build command empty.
5. Deploy the site.

## Files

- [app.js](/Users/macbook/Desktop/company-marketplace/app.js): Supabase-powered marketplace logic
- [index.html](/Users/macbook/Desktop/company-marketplace/index.html): page structure
- [styles.css](/Users/macbook/Desktop/company-marketplace/styles.css): dark responsive styling
- [supabase/setup.sql](/Users/macbook/Desktop/company-marketplace/supabase/setup.sql): database schema, trigger, and RLS policies
- [netlify.toml](/Users/macbook/Desktop/company-marketplace/netlify.toml): static deployment config

## Notes

- The Supabase project URL and publishable key are configured in [app.js](/Users/macbook/Desktop/company-marketplace/app.js).
- Publishable keys are safe to expose in the browser. Security comes from Supabase Row Level Security policies.
- The older Python deployment files remain in the repo only as a paid-hosting fallback.
