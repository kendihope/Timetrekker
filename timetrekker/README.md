# Timetrekker — deployment guide

This is the real, deployable version of your app: signup/login, a private database
per user, and secure file storage for your documents. Everything below is free.

## What you'll create (all free tiers)
1. A **Supabase** project — your database, authentication, and file storage
2. A **GitHub** repository — holds your code
3. A **Vercel** (or Netlify) project — hosts the live app at a real URL

---

## Step 1 — Create your Supabase project
1. Go to https://supabase.com and sign up (free).
2. Click **New project**. Pick any name (e.g. "timetrekker") and a strong database password — save that password somewhere safe.
3. Wait ~2 minutes for it to finish setting up.
4. In the left sidebar, go to **SQL Editor** → **New query**.
5. Open `supabase/schema.sql` from this project, copy all of it, paste it into the SQL editor, and click **Run**.
   This creates all your tables, security rules, and a private file storage bucket.
6. Go to **Project Settings** → **API**. You'll need two values from this page in Step 3:
   - **Project URL**
   - **anon public** key

### Optional: enable Google sign-in
If you want the "Continue with Google" button to work:
1. In Supabase, go to **Authentication** → **Providers** → **Google**, and toggle it on.
2. You'll need a Google Cloud OAuth Client ID/Secret — Supabase's docs walk through this:
   https://supabase.com/docs/guides/auth/social-login/auth-google
3. If you skip this, email sign-up still works perfectly — Google is just a secondary option.

### Email link behavior
By default, Supabase sends a real magic-link email when someone signs up. In
**Authentication → URL Configuration**, set the **Site URL** to your eventual
deployed URL (you'll get this in Step 3) so the email link sends people to the
right place instead of localhost.

---

## Step 2 — Put the code on GitHub
1. Go to https://github.com and sign up (free) if you don't have an account.
2. Click **New repository**, name it `timetrekker`, keep it private or public, and create it.
3. Upload all the files from this project folder into that repository
   (GitHub's web uploader works fine — drag the whole folder in).

---

## Step 3 — Deploy on Vercel
1. Go to https://vercel.com and sign up (free) using your GitHub account.
2. Click **Add New... → Project**, and select your `timetrekker` repository.
3. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Project URL from Step 1
   - `VITE_SUPABASE_ANON_KEY` → your anon public key from Step 1
4. Click **Deploy**. In about a minute you'll get a real URL like
   `https://timetrekker.vercel.app` — that's your live app.
5. Go back to Supabase → **Authentication → URL Configuration** and set the
   Site URL to that Vercel URL, so sign-up emails link to the right place.

---

## Trying it out
- Open your Vercel URL, sign up with your email, check your inbox, click the
  link — you're in, with a completely blank app ready for your own classes,
  tasks, budget, and documents.
- Because sessions persist in the browser, you won't need to sign in again on
  that device unless you tap **Log out** in Settings.
- Every new person who signs up gets their own private, empty account —
  nobody sees anyone else's data.

## Making changes later
Any time you want a new feature, I can update the code here in chat, and you
just re-upload the changed files to GitHub — Vercel automatically redeploys
within a minute or two.
