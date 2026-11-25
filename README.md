# My Health

A personal health tracker that works on your phone (add it to your home screen) and on your PC.

- **Food photos** → Claude recognises the food, you enter the quantity, nutrients come from USDA FoodData Central
  (calories, protein, carbs, fat, fiber, sugar, sodium, 8 minerals, 11 vitamins).
- **InBody** → photograph or upload the result sheet; Claude reads the values and you confirm them.
- **Apple Health** → steps, exercise, sleep, heart rate and weight sync from your iPhone via the Health Auto Export app.
- **Daily report** → green / amber / red flags against your targets, with suggestions to fix the red ones.
  Built automatically every morning at 06:00 Riyadh time, and on demand from the Report tab.

Stack: Next.js on Vercel, Supabase (database, login, private photo storage), Claude API, USDA FoodData Central.

## One-time setup

1. **Supabase** → SQL Editor → paste `supabase/migrations/0001_init.sql` → Run.
2. **Vercel** → import this repository and add the environment variables below → Deploy.
3. Open the site, create your account, then fill in **Settings** (sex, height, birth year, activity, goal).
4. Optional: Supabase → Authentication → Sign In / Providers → turn off **Allow new users to sign up** once your account exists.
5. iPhone: install **Health Auto Export**, then follow the steps on the Settings page.

### Environment variables (Vercel → Settings → Environment Variables)

| Name | Where to get it | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Supabase → API Keys → Publishable key | no |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | Supabase → API Keys → Secret key | yes |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | yes |
| `USDA_API_KEY` | api.data.gov/signup | yes |
| `CRON_SECRET` | any long random string | yes |
| `REPORT_TIMEZONE` | e.g. `Asia/Riyadh` | no |

## Development

```bash
npm ci
npm run dev
npm test
npm run build
```

Nutrient values are estimates and some foods have incomplete vitamin/mineral data. This is general guidance, not medical advice.
