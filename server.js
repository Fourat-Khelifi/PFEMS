import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";
import errorMiddleware from "./src/shared/middlewares/error.middleware.js";
import { PORT, CORS_ORIGIN } from "./src/shared/config/index.js";
import { connectDB } from "./src/shared/db/db_config.js";
import authRouter from "./src/modules/Authentication/index.js";
import teamARouter from "./src/modules/Team_A/index.js";
import teamBRouter from "./src/modules/Team_B/index.js";
import teamCRouter from "./src/modules/Team_C/index.js";
import teamDRouter from "./src/modules/Team_D/index.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/shared/config/swagger.js";

const app = express();

// ---------------- CORS Setup ----------------
app.use(
  cors({
    origin: CORS_ORIGIN, // <-- configurable origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true, // allows cookies/auth headers
  }),
);

// ---------------- Middleware ----------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(logger("combined"));

// ---------------- Connect DB ----------------
await connectDB();

// ---------------- Swagger ----------------
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "PFE Management API Docs",
  }),
);

// ---------------- Routes ----------------
app.use("/api", authRouter);
app.use("/api", teamARouter);
app.use("/api", teamBRouter);
app.use("/api", teamCRouter);
app.use("/api", teamDRouter);

// ---------------- Error Middleware ----------------
app.use(errorMiddleware);

// ---------------- Start Server ----------------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
