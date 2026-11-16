# (un)Jaded

[![Website](https://img.shields.io/badge/Visit-unjadedatx.com-255F38?style=for-the-badge&logo=google-chrome&logoColor=white)](https://www.unjadedatx.com)

This repository contains the official code for **(un)Jaded**, a student organization at the University of Texas at Austin focused on mental health and social advocacy, for Fall 2025–Spring 2026.

## 🌱 About (un)Jaded
(un)Jaded is a mental health and service organization intended to destigmatize mental health and encourage social advocacy amongst the AAPI community. (un)Jaded recognizes the need for a culturally aware space that is committed to celebrating Asian identities, addressing intersectional issues, and promoting greater community involvement. Membership is open to self-identified Asians, Pacific Islanders, Asian Americans, and allies attending the University of Texas at Austin.
(un)Jaded will advocate for and educate on its values of...
- Mental Health
- Social Advocacy
- Community Outreach

## 🚀 Features
- Responsive design for desktop and mobile
- Information about our mission and values
- Team and leadership details
- Upcoming events on the calendar
- Workshop information
- Contact and social media links

## 🛠️ Tech Stack
- **HTML5 / CSS3 / JavaScript**

## 💬 Community feed
The Community page (`community.html`) lets signed-in visitors post text and images, like, comment, edit, delete, and report posts. Anyone can read it.

- **Frontend:** `community.html`, `src/styles/community-styles.css`, `src/scripts/community.js`
- **Backend:** a Cloudflare Worker (`worker/`) that handles `/api/*`, with sign-in through Google only. Accounts, posts, comments, likes, reports, and admins live in D1 (`DB`). Images live in Workers KV (`IMAGE_KV`), up to 5 per post and 1 MB each; the browser compresses photos automatically before upload.
- **Admins:** add rows to the `admins` table in the D1 dashboard (lowercase Google email). Admins can delete any post or comment, review the "Reported" list, or ban a user, which deletes everything they posted. To undo a ban, set `users.banned = 0` in D1.
- **Limits:** `POSTS_PER_HOUR` and `COMMENTS_PER_HOUR` in `wrangler.jsonc`
- **Report emails:** when a post reaches `REPORT_THRESHOLD` reports, all admins get one email. It's sent through a small Google Apps Script (`worker/apps-script/Code.gs`) that lives in a Google account and sends mail as that account. The Worker needs two secrets, set with `wrangler secret put`: `APPS_SCRIPT_URL` and `APPS_SCRIPT_SECRET`. Without them nothing is emailed and reports still appear in the admins' "Reported" list.

### Local development
Sign-in is Google only (there is no other way to sign in, locally or in production). The Google OAuth client allows the origin `http://localhost`, so run the dev server on port 80 and open `http://localhost/community`:
```bash
cp .dev.vars.example .dev.vars                      # optional local settings
npx wrangler d1 migrations apply unjaded-community --local
npx wrangler dev --port 80 --ip 0.0.0.0             # http://localhost/community
```
To try report emails locally, set `REPORT_THRESHOLD`, `APPS_SCRIPT_URL`, and `APPS_SCRIPT_SECRET` in `.dev.vars`.

To try admin features locally, sign in once with Google, then add your Google email:
```bash
npx wrangler d1 execute unjaded-community --local --command "INSERT INTO admins (email) VALUES ('you@example.com')"
```

## 🌐 Deployment (Cloudflare Workers)
The site is a Cloudflare Worker serving static files, deployed from `main` by Cloudflare's Git integration (`npx wrangler deploy`). Pushing to `main` redeploys it. Files that aren't part of the site (`worker/`, `migrations/`, this README) are excluded in `.assetsignore`.

---

© 2025 (un)Jaded at The University of Texas at Austin
