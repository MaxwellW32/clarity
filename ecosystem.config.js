// pm2 process definition for the Travel Advantage Next.js app.
//
// Usage (Linux):
//   npm i -g pm2
//   pm2 start ecosystem.config.js     # first run
//   ./deploy.sh                       # pull + install + build + (re)start
//
// Single Next.js app. Runs the Next binary directly (needs a prior
// `next build`). Secrets are read from .env.local (gitignored).
module.exports = {
  apps: [
    {
      name: "clarity",
      cwd: "./",
      // Run the Next binary directly instead of `npm start` so pm2 owns the
      // server process — memory stats, max_memory_restart, and signals work.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3014",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 4000,
      // Surface crashes early instead of hot-looping on a bad config/env.
      min_uptime: "20s",
      env: { NODE_ENV: "production" },
    },
  ],
};
