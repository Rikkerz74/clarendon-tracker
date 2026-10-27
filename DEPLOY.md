# Deploying Clarendon Tracker

This app is a Node.js server, so it needs a host that runs `npm start` and keeps the `data/` and `uploads/` folders persistent.

## Simplest route

Use a Node host such as Render, Railway, or Fly.io.

## Required environment variables

- `NODE_VERSION=24.22.1` - patched Node.js runtime; use a later patched release in the Node 24 major when available
- `JWT_SECRET` - long random string
- `DEFAULT_OWNER_EMAIL` - login email for the owner
- `DEFAULT_OWNER_PASSWORD` - login password for the owner
- `DEFAULT_OWNER_NAME` - display name for the owner
- `NODE_ENV=production`

## Data you must keep

- `data/state.json`
- `uploads/`

If your host does not provide persistent disk storage, the tracker will lose saved data after restart.

## Recommended Render setup

1. Create a new Web Service from this GitHub repo.
2. Set the build command to `npm install`.
3. Set the start command to `npm start`.
4. Set `NODE_VERSION` to `24.22.1` or a later patched Node.js 24 release, and add the other environment variables listed above.
5. Add persistent disk storage for `data/` and `uploads/`.
6. Rebuild and redeploy the service so it uses the patched runtime and current system certificate store, then sign in at `/login.html`.

## Demo login

- Email: `owner@clarendon.local`
- Password: `tdbmclarendon2352`

## First test after deploy

1. Sign in.
2. Change one score.
3. Switch to the roadmap.
4. Refresh the page.
5. Upload and re-open one document.