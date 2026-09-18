# Yayin Tov enquiry form setup

The website form is already connected to `/api/leads`. Complete these account steps before testing it on the live site.

## 1. Supabase

Open the Supabase SQL Editor, paste the contents of `supabase.sql`, and run it once. This creates or updates the private `leads` table.

Copy the project URL and secret key into Vercel as:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

If Vercel already has the key under `SUPABASE_SERVICE_ROLE_KEY`, the function accepts that name too.

## 2. HubSpot

Create a Service Key named `YayinTov Website` with these scopes:

- `crm.objects.contacts.read`
- `crm.objects.contacts.write`

Add it to Vercel as `HUBSPOT_SERVICE_KEY`.

For complete enquiry details inside each HubSpot contact, create these optional contact properties using the exact internal names below. Use single-line text for the first three and multi-line text for the remaining fields:

- `wedding_date`
- `wedding_location`
- `referral_source`
- `wedding_description`
- `most_excited_about`
- `biggest_concern`
- `desired_relief`
- `support_needed`
- `submission_source`

If these properties are not created, HubSpot still receives the contact’s name, email, phone number and lifecycle stage. The complete enquiry remains available in Supabase and the Zoho notification email.

## 3. Resend and Zoho

After verifying `yayintov.com` in Resend, add these Vercel variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` = `Yayin Tov <hello@yayintov.com>`
- `BUSINESS_EMAIL` = `hello@yayintov.com`

Zoho remains the inbox for `hello@yayintov.com`. Resend sends the automated customer confirmation and a detailed notification to that Zoho inbox.

## 4. Vercel

Add every variable to Production, Preview and Development, mark the secret keys as Sensitive, then redeploy the latest deployment.

## 5. Test

Submit one test enquiry from the deployed website and confirm that:

1. A new row appears in Supabase.
2. A contact appears in HubSpot.
3. The test customer receives a confirmation email.
4. `hello@yayintov.com` receives the detailed enquiry in Zoho.
