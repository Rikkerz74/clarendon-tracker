# Deploying Clarendon Tracker

This app is a Node.js server, so it needs a host that runs `npm start` and keeps the `data/` and `uploads/` folders persistent.

## Simplest route

Use a Node host such as Render, Railway, or Fly.io.

## Required environment variables

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
4. Add the environment variables listed above.
5. Add persistent disk storage for `data/` and `uploads/`.
6. Deploy and sign in at `/login.html`.

## Demo login

- Email: `owner@clarendon.local`
- Password: `ChangeMe123!`

## First test after deploy

1. Sign in.
2. Change one score.
3. Switch to the roadmap.
4. Refresh the page.
5. Upload and re-open one document.