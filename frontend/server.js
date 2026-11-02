/*
 * Passenger startup file for the Next.js app.
 *
 * The shared host has no process manager and no shell, so `next start` cannot be
 * launched or kept alive by hand. cPanel's Node.js Selector runs the app under
 * Phusion Passenger instead, and Passenger boots the app by requiring THIS file
 * rather than by running an npm script — so `npm start` is never involved on the
 * server and this file is the real entry point.
 *
 * Passenger patches `Server.listen()`, so the port below is mostly a formality:
 * it hands the socket to the app itself. `process.env.PORT` is honoured for the
 * cases where it does supply one, and for running this file directly to debug.
 *
 * `dev: false` is deliberate and must stay: without it Next tries to compile on
 * demand, which needs the dev dependencies and a writable cache that a
 * production install does not have.
 */
const { createServer } = require('http');
const next = require('next');

const port = parseInt(process.env.PORT, 10) || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port);
  })
  .catch((err) => {
    // Passenger surfaces a failed boot as a bare 502, which says nothing about
    // the cause. Log it explicitly so the reason lands in stderr.
    console.error('Next.js failed to start:', err);
    process.exit(1);
  });
