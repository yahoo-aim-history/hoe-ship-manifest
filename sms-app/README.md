# Hoe Ship Manifest SMS Desk

A local, single-recipient SMS sender. The browser talks to a Node server, which sends through Twilio. Credentials stay on the server and are never sent to the browser.

## Run locally

Requirements: Node.js 20 or newer and a Twilio account.

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set the Twilio account SID, auth token, and sender number.
3. Start with `npm run dev` and open `http://127.0.0.1:3000`.

The server binds to localhost only. Do not expose it publicly without authentication, rate limits, and abuse controls. A Twilio trial account may only send to verified recipient numbers. Send only to recipients who have consented.

This sends SMS through Twilio. Meta Messenger is a separate product and cannot deliver SMS to phone numbers.