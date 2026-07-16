# Clarendon Business Diagnostics

A hosted, authenticated diagnostics tracker for the Clarendon Dental business plan. Owners can sign in, review the live business diagnostics tracker, and switch to the roadmap view that summarises all three phases and timescales from the shared server state.

## What it includes

- Secure sign-in with a demo owner account
- Live tracker page for the audit sections
- Live roadmap page for the three phases and timescales
- Server-backed persistence shared across sessions
- Export and import of the full audit as JSON
- Sign out from either page

## Run locally

1. Open a terminal in this folder.
2. Run `npm install` if dependencies are not already installed.
3. Start the app with `npm start`.
4. Open `http://localhost:3000/login.html` in a browser.

## Demo login

- Email: `owner@clarendon.local`
- Password: `ChangeMe123!`

## Notes

The hosted version replaces the earlier file-based prototype so the plan data is saved centrally and stays in sync across pages. The persistent state lives in `data/state.json` for local development.
