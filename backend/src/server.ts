import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/prisma.js";
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () =>
  console.log(`Dolil OS API listening on :${port}`)
);
const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
