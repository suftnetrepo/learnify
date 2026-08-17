# Learnify — Production Deployment Guide

## Stack
- **Hosting**: Vercel (recommended) or Railway
- **Database**: Neon PostgreSQL (serverless-friendly)
- **Media**: Cloudinary
- **Payments**: Stripe
- **Email**: Resend

---

## 1. Database — Neon PostgreSQL

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the **pooler connection string** (port 6543, not 5432):
   ```
   postgresql://user:pass@ep-xxx.eu-west-2.aws.neon.tech:6543/learnify?pgbouncer=true&connect_timeout=10&sslmode=require
   ```
3. Set `DATABASE_URL` to this pooler string
4. Push schema: `DATABASE_URL="<url>" yarn db:push`
5. Seed initial data: `DATABASE_URL="<url>" yarn db:seed`

> Always use the pooler URL (port 6543) on serverless platforms — the direct URL exhausts connections.

---

## 2. Stripe

**Test → Production:**
- Replace `sk_test_` with `sk_live_` and `pk_test_` with `pk_live_`

**Webhook setup:**
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://yourdomain.com/api/webhooks/stripe`
3. Events to select:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `payment_intent.payment_failed`
   - `charge.dispute.created`
   - `transfer.failed`
   - `account.updated`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

---

## 3. Cloudinary

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Copy Cloud name, API Key, API Secret from Dashboard
3. Set all four Cloudinary env vars

---

## 4. Resend

1. Create account at [resend.com](https://resend.com)
2. Verify your sending domain
3. Create API key → `RESEND_API_KEY`
4. Set `EMAIL_FROM` to a verified sender
5. Set `ADMIN_EMAIL` for admin alert emails

---

## 5. Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Neon pooler URL (port 6543) |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | `https://yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | Yes | Same as NEXTAUTH_URL |
| `STRIPE_SECRET_KEY` | Yes | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes | `whsec_...` |
| `STRIPE_PLATFORM_FEE_PERCENT` | Yes | Default: 20 |
| `CLOUDINARY_CLOUD_NAME` | Yes | |
| `CLOUDINARY_API_KEY` | Yes | |
| `CLOUDINARY_API_SECRET` | Yes | |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Yes | Same as CLOUDINARY_CLOUD_NAME |
| `RESEND_API_KEY` | Yes | |
| `EMAIL_FROM` | Yes | `noreply@yourdomain.com` |
| `ADMIN_EMAIL` | Yes | Receives admin alerts |

---

## 6. Deploy to Vercel

```bash
npm i -g vercel && vercel --prod
```

Or connect GitHub repo in Vercel dashboard. Build settings are auto-detected.

**Post-deploy:**
1. Verify Stripe webhook endpoint is reachable
2. Test checkout with card `4242 4242 4242 4242`
3. Confirm purchase confirmation email arrives

---

## 7. Deploy to Railway

1. Connect repo at [railway.app](https://railway.app)
2. Set all env vars in Variables tab
3. Set `RAILWAY_ENVIRONMENT=production`

---

## 8. Post-launch Checklist

- [ ] Stripe live keys configured
- [ ] All 8 webhook events registered in Stripe
- [ ] `AUTH_SECRET` is a securely generated 32+ char string
- [ ] `DATABASE_URL` uses pooler URL (port 6543)
- [ ] `ADMIN_EMAIL` set and tested
- [ ] Resend domain verified — test email delivered
- [ ] Sitemap submitted to Google Search Console
- [ ] Forgot password flow tested end-to-end
- [ ] Mobile checkout tested on real device
- [ ] Tutor invite → register → approve flow tested
