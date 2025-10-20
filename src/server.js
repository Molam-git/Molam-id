import Fastify from "fastify";
import signupRoutes from "./routes/signup.js";
import loginRoutes from "./routes/login.js";
import refreshRoutes from "./routes/refresh.js";
import dotenv from "dotenv";

dotenv.config();
const app = Fastify({ logger: true });

app.register(signupRoutes);
app.register(loginRoutes);
app.register(refreshRoutes);

const port = process.env.PORT || 3000;
app.listen({ port }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running on ${address}`);
});
