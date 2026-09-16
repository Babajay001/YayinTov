const MAX_BODY_BYTES = 48_000;

function clean(value, maxLength = 1600) {
  return String(value || "").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return clean(value, 5000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

function splitName(fullName) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || fullName,
    lastName: parts.join(" "),
  };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function saveToSupabase(lead) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(lead),
  });

  const data = await readJson(response);
  if (!response.ok) {
    console.error("Supabase lead insert failed", response.status, data);
    throw new Error("We could not securely save this enquiry.");
  }

  return Array.isArray(data) ? data[0] : data;
}

async function upsertHubSpotContact(lead) {
  const serviceKey = process.env.HUBSPOT_SERVICE_KEY;
  if (!serviceKey) return;

  const { firstName, lastName } = splitName(lead.name);
  const standardProperties = {
    email: lead.email,
    firstname: firstName,
    lastname: lastName,
    phone: lead.phone,
    lifecyclestage: "lead",
  };
  const customProperties = {
    wedding_date: lead.wedding_date,
    wedding_location: lead.wedding_location,
    referral_source: lead.referral_source,
    wedding_description: lead.wedding_description,
    most_excited_about: lead.most_excited_about,
    biggest_concern: lead.biggest_concern,
    desired_relief: lead.desired_relief,
    support_needed: lead.support_needed,
    submission_source: "Yayin Tov website",
  };

  async function send(properties) {
    return fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [{ id: lead.email, idProperty: "email", properties }],
      }),
    });
  }

  let response = await send({ ...standardProperties, ...customProperties });

  // The contact still gets created when the optional custom properties have
  // not yet been added to the client's HubSpot account.
  if (!response.ok) {
    const firstError = await readJson(response);
    console.warn("HubSpot custom property sync failed; retrying basic contact", firstError);
    response = await send(standardProperties);
  }

  if (!response.ok) {
    console.error("HubSpot contact sync failed", response.status, await readJson(response));
  }
}

function detailRow(label, value) {
  if (!value) return "";
  return `<tr><td style="padding:10px 16px 10px 0;color:#7b6d57;vertical-align:top;width:180px">${escapeHtml(label)}</td><td style="padding:10px 0;color:#2b271f;line-height:1.55">${escapeHtml(value)}</td></tr>`;
}

async function sendResendEmail(message, idempotencyKey) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    console.error("Resend email failed", response.status, await readJson(response));
  }
}

async function sendEmails(lead, leadId) {
  if (!process.env.RESEND_API_KEY) return;

  const from = process.env.RESEND_FROM_EMAIL || "Yayin Tov <hello@yayintov.com>";
  const businessEmail = process.env.BUSINESS_EMAIL || "hello@yayintov.com";
  const safeName = escapeHtml(lead.name);
  const reference = leadId || `${Date.now()}-${lead.email}`;

  const confirmation = {
    from,
    to: [lead.email],
    reply_to: businessEmail,
    subject: "We’ve received your bridal consultation enquiry",
    html: `
      <div style="background:#fbf7f0;padding:40px 18px;font-family:Arial,sans-serif;color:#2b271f">
        <div style="max-width:600px;margin:0 auto;background:#fff;padding:38px;border-top:3px solid #a9812f">
          <p style="margin:0 0 22px;color:#a9812f;font-size:12px;letter-spacing:2px;text-transform:uppercase">Yayin Tov Bridal Concierge</p>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:34px;font-weight:normal">Thank you, ${safeName}.</h1>
          <p style="margin:22px 0 0;font-size:16px;line-height:1.75;color:#625a4c">We’ve received the details of your wedding and appreciate the care you took in sharing them. Our team will review your enquiry and contact you soon to discuss the next step.</p>
          <div style="margin-top:28px;padding:20px;background:#f5eee2">
            <p style="margin:0 0 7px;font-size:13px;color:#7b6d57">Wedding date</p>
            <p style="margin:0;font-size:16px">${escapeHtml(lead.wedding_date)}</p>
            <p style="margin:16px 0 7px;font-size:13px;color:#7b6d57">Location</p>
            <p style="margin:0;font-size:16px">${escapeHtml(lead.wedding_location)}</p>
          </div>
          <p style="margin:28px 0 0;font-size:14px;line-height:1.65;color:#625a4c">If you need to add anything, simply reply to this email or contact <a href="mailto:${businessEmail}" style="color:#4a5233">${businessEmail}</a>.</p>
        </div>
      </div>`,
  };

  const notification = {
    from,
    to: [businessEmail],
    reply_to: lead.email,
    subject: `New bridal enquiry from ${lead.name}`,
    html: `
      <div style="background:#fbf7f0;padding:32px 18px;font-family:Arial,sans-serif;color:#2b271f">
        <div style="max-width:720px;margin:0 auto;background:#fff;padding:34px;border-top:3px solid #a9812f">
          <p style="margin:0 0 18px;color:#a9812f;font-size:12px;letter-spacing:2px;text-transform:uppercase">New website enquiry</p>
          <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:30px;font-weight:normal">${safeName}</h1>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            ${detailRow("Email", lead.email)}
            ${detailRow("Phone", lead.phone)}
            ${detailRow("Wedding date", lead.wedding_date)}
            ${detailRow("City or venue", lead.wedding_location)}
            ${detailRow("Referral source", lead.referral_source)}
            ${detailRow("Wedding vision", lead.wedding_description)}
            ${detailRow("Most excited about", lead.most_excited_about)}
            ${detailRow("Biggest concern", lead.biggest_concern)}
            ${detailRow("Desired relief", lead.desired_relief)}
            ${detailRow("Support requested", lead.support_needed)}
          </table>
          <p style="margin:26px 0 0;font-size:13px;color:#7b6d57">Reply to this email to respond directly to ${safeName}.</p>
        </div>
      </div>`,
  };

  await Promise.all([
    sendResendEmail(confirmation, `lead-confirmation-${reference}`),
    sendResendEmail(notification, `lead-notification-${reference}`),
  ]);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return response.status(413).json({ error: "This enquiry is too large to submit." });
  }

  let body;
  try {
    body = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
  } catch {
    return response.status(400).json({ error: "The form data is not valid. Please try again." });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json({ error: "The form data is not valid. Please try again." });
  }

  // Silently accept automated honeypot submissions without storing anything.
  if (clean(body.company, 200)) {
    return response.status(200).json({ ok: true });
  }

  const elapsed = Date.now() - Number(body.startedAt || 0);
  if (!Number.isFinite(elapsed) || elapsed < 900) {
    return response.status(400).json({ error: "Please review the form and try again." });
  }

  const lead = {
    name: clean(body.fullName, 120),
    email: clean(body.email, 160).toLowerCase(),
    phone: clean(body.phone, 40),
    wedding_date: clean(body.weddingDate, 20),
    wedding_location: clean(body.weddingLocation, 180),
    referral_source: clean(body.referralSource, 120),
    wedding_description: clean(body.weddingDescription),
    most_excited_about: clean(body.mostExcited, 1200),
    biggest_concern: clean(body.biggestConcern, 1200),
    desired_relief: clean(body.desiredRelief, 1200),
    support_needed: clean(body.supportNeeded),
    source: "website",
    status: "new",
    consent: body.consent === true,
  };

  const required = [
    lead.name,
    lead.email,
    lead.phone,
    lead.wedding_date,
    lead.wedding_location,
    lead.wedding_description,
    lead.biggest_concern,
    lead.support_needed,
  ];

  if (required.some((value) => !value) || !validEmail(lead.email) || !lead.consent) {
    return response.status(400).json({ error: "Please complete all required fields." });
  }

  try {
    const savedLead = await saveToSupabase(lead);
    const leadId = savedLead?.id;

    const integrations = await Promise.allSettled([
      upsertHubSpotContact(lead),
      sendEmails(lead, leadId),
    ]);

    integrations.forEach((result) => {
      if (result.status === "rejected") console.error("Lead integration failed", result.reason);
    });

    return response.status(201).json({ ok: true });
  } catch (error) {
    console.error("Lead submission failed", error);
    return response.status(500).json({
      error: "We couldn’t send your enquiry right now. Please try again or email hello@yayintov.com.",
    });
  }
}
