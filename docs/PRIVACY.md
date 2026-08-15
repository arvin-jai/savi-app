# Savi — Privacy Policy

**Last updated:** 2026-08-15
**Applies to:** Savi for Android and the Savi web app

> ⚠️ **Before publishing:** the placeholders marked `[…]` below must be filled in with real
> details — the publisher's legal name, a working contact address, and the hosting region.
> A privacy policy with a placeholder contact is not a privacy policy. This document is
> accurate about what the software does; only the identifying details are outstanding.
>
> This is a plain-language description written by the people who built the app. It is not
> legal advice, and it has not been reviewed by a lawyer. Have it reviewed before you publish
> to a store.

---

## The short version

Savi holds your financial information. Here is what that means in practice:

- **Your data is yours.** It is stored in your own account and no other user can read it. That
  is enforced by the database itself, not just by the app.
- **We do not sell your data.** Not to advertisers, not to data brokers, not to anyone.
- **When you use Ask Savi, some of your figures are sent to an AI service** so it can write an
  answer. Your name, email address, and account names are not. You can switch this off, and
  the app keeps working.
- **You can delete your data**, including your whole account.

---

## What Savi stores

All of it in your own account, readable only by you:

| Category | Examples |
| --- | --- |
| Account | Email address, display name, currency preference |
| Money | Accounts and balances, transactions, bills and payments, recurring income |
| Time | Calendar events, tasks |
| Plans | Budgets, savings goals |
| Preferences | Theme, notification settings, AI settings |
| Ask Savi | Your questions and Savi's answers, if you use it |

**How the isolation works.** Every table has row-level security: the database refuses to return
another user's rows regardless of what the application asks for. This is verified by an
automated test suite that signs in as a second user and confirms it sees nothing.

**Where it is stored.** Supabase (PostgreSQL), hosted in `[REGION — fill in before publishing]`.

---

## Ask Savi, and what leaves your device

This is the part that deserves the most detail, because it is the only time your information
goes anywhere else.

### Only when you use it

Savi's insight card works **on your device** using ordinary arithmetic over your own data — it
sends nothing anywhere. The AI features are what involve a third party, and only when you ask a
question or when an AI-written insight is generated.

### What is sent

Your question, and a summary of the figures needed to answer it:

- Your available money, current balance, upcoming bills total, income and expense totals
- Bill names, amounts and due dates
- Recent expense descriptions, amounts, categories
- Spending totals per category
- Calendar event and task titles with their dates
- Savings goal names, targets and progress
- Your budget, if you have set one

### What is never sent

- Your name or display name
- Your email address
- Your user ID or any internal identifier
- Your account names or individual account balances (e.g. which bank you use)
- Your password, session token, or any credential

### Who it is sent to

OpenAI, as the AI provider, through a server we control. The API key never exists on your
device. OpenAI's handling of API data is governed by their own terms; at the time of writing,
data submitted through their API is not used to train their models by default.

### What Savi can and cannot do

Savi can **read** your data to answer questions.

Savi can **create** a task, a reminder, or a calendar event — but only if you have switched that
permission on individually, and only after showing you exactly what it is about to do and
getting your confirmation. Nothing is saved without that confirmation.

**Savi can never move money, make a payment, record a transaction, change anything you already
have, or delete anything.** There is no permission that enables those. This is enforced in the
database and in the server, not only in the app.

### Turning it off

Settings → Ask Savi. When it is off:

- No question or figure is sent anywhere, and the server refuses to send anything even if an
  out-of-date copy of the app tries.
- The insight card keeps working, using the on-device calculations.

You can also delete every saved conversation from the same screen.

---

## Notifications

Bill and task reminders are scheduled **on your device**. Savi does not send your due dates to a
server to work out when to notify you, and reminders work without a network connection. The
Android permission is requested only when you turn reminders on, never at launch.

---

## What Savi does not do

- No advertising, and no advertising identifiers.
- No analytics or behavioural tracking SDKs.
- No selling or sharing of personal information with third parties for their own purposes.
- No access to your bank. Savi has no connection to any financial institution; everything in it
  is what you entered yourself.
- No location data, contacts, photos, or microphone access.

---

## Crash reports

If crash reporting is enabled in a released build, Savi collects the technical details of a
crash — the error, where in the code it happened, the device model and OS version — so the bug
can be fixed. **Crash reports never include your financial data**, your transactions, or the
contents of your conversations.

> `[Fill in before publishing: the crash reporting provider, or state that none is used.]`

---

## Your choices

| You want to | How |
| --- | --- |
| Stop AI features entirely | Settings → Ask Savi → off |
| Remove what Savi can create | Settings → Ask Savi → turn off each permission |
| Delete your conversations | Settings → Ask Savi → Delete all conversations |
| Delete a goal, bill, account or transaction | Delete it in the app; it is removed from the database |
| Turn off reminders | Settings → Notifications |
| Delete your entire account and all data | Contact us at `[CONTACT — fill in]` |

Deleting your account removes every row belonging to you — the database cascades the deletion
across all of it.

---

## Children

Savi is not directed at children under 13 and we do not knowingly collect their information.

---

## Changes to this policy

If what Savi does with your data changes in a way that matters, this document changes with it
and the "last updated" date above moves. Material changes will be surfaced in the app rather
than only posted here.

---

## Contact

`[PUBLISHER LEGAL NAME — fill in]`
`[CONTACT EMAIL — fill in]`
`[POSTAL ADDRESS, if required by your store listing — fill in]`
