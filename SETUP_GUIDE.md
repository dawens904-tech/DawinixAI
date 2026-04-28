# Dawinix AI — Complete Setup Guide

> Follow this guide step-by-step to make the bot reply instantly when someone texts your WhatsApp number.

---

## Overview

When someone sends a message to your WhatsApp number:

```
User texts WhatsApp → Meta sends it to your Webhook URL → Edge Function receives it
→ Sends to OpenAI/Gemini AI → Gets smart reply → Sends back to user on WhatsApp
```

---

## Step 1 — Create a Meta Developer App

1. Go to [https://developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps → Create App**
3. Select **Business** as the app type
4. Fill in your app name (e.g. "Dawinix AI") and click **Create App**
5. From the dashboard, find **WhatsApp** and click **Set Up**

---

## Step 2 — Get Your WhatsApp Credentials

Inside your Meta app → **WhatsApp → API Setup**:

| Value | Where to find it |
|---|---|
| **Phone Number ID** | Shown under "From" phone number |
| **Access Token** | Click "Generate token" (use a permanent System User token, see Step 3) |
| **Verify Token** | You create this — any random string, e.g. `dawinix_verify_2024` |

### ⚠️ Use a Permanent System User Token (Important)

Temporary tokens expire in 24 hours. To create a permanent one:

1. Go to [Meta Business Suite](https://business.facebook.com) → **Settings → System Users**
2. Click **Add** → name it "Dawinix Bot" → role: Admin
3. Click **Generate New Token** → select your app
4. Check these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Copy the token — this never expires

---

## Step 3 — Save Secrets in OnSpace Cloud

In the **OnSpace Dashboard → Cloud → Secrets**, add these:

| Secret Name | Value |
|---|---|
| `PHONE_NUMBER_ID` | Your WhatsApp Phone Number ID from Step 2 |
| `ACCESS_TOKEN` | Your permanent System User token from Step 2 |
| `WEBHOOK_VERIFY_TOKEN` | The random string you chose (e.g. `dawinix_verify_2024`) |
| `OPENAI_API_KEY` | Your OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys) |
| `APP_ID` | Your Meta App ID (shown on the app dashboard) |

> **Never put these in source code files.** Always use Secrets.

---

## Step 4 — Configure the Webhook in Meta

1. In your Meta app → **WhatsApp → Configuration**
2. Click **Edit** next to Webhook
3. Set **Callback URL** to:
   ```
   https://zmkdygoyejtywrftzmkd.backend.onspace.ai/functions/v1/whatsapp-webhook
   ```
4. Set **Verify Token** to the same value you set in `WEBHOOK_VERIFY_TOKEN`
5. Click **Verify and Save** — you should see a green checkmark ✅
6. Under **Webhook Fields**, subscribe to: `messages`

---

## Step 5 — Add a Test Phone Number (Development Mode)

In Development mode, WhatsApp only allows pre-approved numbers to receive messages.

1. Go to **WhatsApp → API Setup**
2. Under the **"To"** field, click **"Manage phone number list"**
3. Click **Add phone number**
4. Enter your personal WhatsApp number with country code (e.g. `+15551234567`)
5. WhatsApp will send you an OTP — enter it to verify

Now send any message to your WhatsApp Business number — the bot will reply!

---

## Step 6 — Test It

1. Open WhatsApp on your phone
2. Send a message to your WhatsApp Business number
3. You should receive an AI reply within 2–5 seconds

**If it works:** 🎉 Your bot is live!

**If it doesn't reply:** See the Troubleshooting section below.

---

## Step 7 — Go Live (Remove All Restrictions)

To allow ANY phone number to message the bot:

1. In your Meta app → **App Review → Permissions and Features**
2. Request these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
3. Complete **Meta Business Verification**:
   - Go to [Meta Business Suite](https://business.facebook.com) → **Settings → Business Info**
   - Submit your business documents
   - Review takes 1–5 business days
4. Once approved, your app goes **Live** — anyone can message the bot

---

## How the AI Reply Works

The `whatsapp-webhook` Edge Function handles everything:

```
1. Meta sends POST to your webhook URL
2. Edge Function extracts: sender phone, message text
3. Marks message as "read" (blue ticks appear immediately)
4. Checks for custom commands (/code, /image, /start, /help)
5. For regular text → sends to OpenAI gpt-4o-mini with conversation history
6. If OpenAI fails → falls back to Gemini 3 Flash (OnSpace AI)
7. Reply is split if > 3800 chars, sent back to user via WhatsApp API
8. Conversation saved to database for memory
```

### Conversation Memory

The bot remembers the last **10 messages** (configurable in Bot Config → AI Settings). This means it understands context like "what did I ask before?" just like ChatGPT.

---

## Commands Users Can Use

| Command | What it does |
|---|---|
| Any text | AI chat reply (no command needed) |
| `/start` | Welcome message |
| `/help` | List all commands |
| `/code [task]` | Generate code (Python, JS, HTML, etc.) |
| `/image [prompt]` | Generate an AI image |

---

## Group Chat Setup

To add the bot to a WhatsApp group:

1. Open the group → tap the group name → **Add Participants**
2. Search for your WhatsApp Business number → Add
3. In **Bot Config → Groups tab**, choose:
   - **Mention Only** — bot replies only when `@mentioned` (recommended)
   - **All Messages** — bot replies to every message in the group

To mention the bot in a group, type:
- `@YourBotNumber` (e.g. `@15551234567`)
- `@Dawinix` or `@Dawinix AI`
- Or reply directly to one of the bot's messages

---

## Troubleshooting

### Bot doesn't reply at all

- Check **System Logs** page in the dashboard — errors appear there
- Verify the webhook is verified (green checkmark in Meta Console)
- Make sure `PHONE_NUMBER_ID` and `ACCESS_TOKEN` are set correctly in Secrets
- Make sure your number is in the allowed list (Development mode) or the app is Live

### Error #131030 — Recipient not in allowed list

Your app is in Development mode. Add the number to the test list (Step 5) or complete Business Verification (Step 7).

### Error: OAuthException code 1

Your Access Token is missing the `whatsapp_business_management` permission:

1. Go to **Meta Business Suite → Settings → System Users**
2. Edit your System User → Generate new token
3. Add permissions: `whatsapp_business_messaging` + `whatsapp_business_management`
4. Copy the new token → update `ACCESS_TOKEN` in OnSpace Cloud Secrets

### Webhook verification fails (403 Forbidden)

The `WEBHOOK_VERIFY_TOKEN` in Secrets doesn't match what you entered in Meta Console. Make sure they are exactly the same string (case-sensitive).

### AI replies but with wrong language

Edit the **System Prompt** in **Bot Config → AI Settings** to include your preferred language instruction. The bot supports English, French, and Haitian Creole by default.

### Image generation doesn't work

Make sure `ONSPACE_AI_API_KEY` and `ONSPACE_AI_BASE_URL` are set in Secrets. These power the `/image` command using Gemini 2.5 Flash Image.

---

## Security Checklist

- ✅ All API keys stored as Edge Function Secrets (never in code)
- ✅ Webhook verify token validated on every request
- ✅ Rate limiting: 50 messages/hour per user (configurable in Bot Config)
- ✅ RLS policies enabled on all database tables
- ✅ HTTPS enforced on all endpoints

---

## Important: Edit Code Only In-App

> ⚠️ **Never edit source files directly on GitHub.** The GitHub web editor has no syntax validation — adding any plain text to a `.tsx` file will break the build immediately.
>
> - To update **API keys/tokens** → use **OnSpace Cloud → Secrets**
> - To update **bot behavior** → use **Bot Config page** in the dashboard
> - To change **source code** → use the **OnSpace in-app editor only**
