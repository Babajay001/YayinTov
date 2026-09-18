# Yayin Tov enquiry form setup

The website form is already connected to `/api/leads`. Complete these account steps before testing it on the live site.

## 1. Supabase

Open the Supabase SQL Editor, paste the contents of `supabase.sql`, and run it once. This creates or updates the private `leads` table.

Copy the project URL and secret key into Vercel as:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

If Vercel already has the key under `SUPABASE_SERVICE_ROLE_KEY`, the function accepts that name too.

The API is compatible with both the original table and the expanded schema. Run `supabase.sql` when possible so each answer also has its own column.

## 2. Zoho CRM

Create a Zoho Self Client with `ZohoCRM.modules.leads.ALL`, generate an authorization code, and exchange it for a refresh token. Add these variables to Vercel:

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ACCOUNTS_URL` (for example `https://accounts.zoho.com`)
- `ZOHO_API_DOMAIN` (for example `https://www.zohoapis.com`)

The function upserts a Lead by email. It stores the contact details in standard Lead fields and the complete questionnaire in the Lead Description, so custom Zoho fields are not required.

## 3. Resend and Zoho

Keep Zoho Mail on the root domain for the client's inbox. Verify a sending subdomain such as `send.yayintov.com` in Resend, then add:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` = `Yayin Tov <notifications@send.yayintov.com>`
- `BUSINESS_EMAIL` = `hello@yayintov.com`

Zoho remains the inbox for `hello@yayintov.com`. Resend sends the automated customer confirmation and a detailed notification to that Zoho inbox.

## 4. Vercel

Add every variable to Production, Preview and Development, mark the secret keys as Sensitive, then redeploy the latest deployment.

## 5. Test

Submit one test enquiry from the deployed website and confirm that:

1. A new row appears in Supabase.
2. A Lead appears or updates in Zoho CRM.
3. The test customer receives a confirmation email.
4. `hello@yayintov.com` receives the detailed enquiry in Zoho.
