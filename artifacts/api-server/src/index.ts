import app from "./app";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  if (process.env.NODE_ENV === "production" && process.env.PRODUCTION_ORIGIN) {
    const healthUrl = `${process.env.PRODUCTION_ORIGIN}/api/healthz`;
    console.log(`Keepalive enabled → ${healthUrl} every 10 minutes`);
    setInterval(async () => {
      try {
        const res = await fetch(healthUrl);
        console.log(`Keepalive ping: ${res.status}`);
      } catch (err: any) {
        console.warn(`Keepalive ping failed: ${err.message}`);
      }
    }, 10 * 60 * 1000);
  }
});
