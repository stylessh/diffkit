import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./db/migrations",
	schema: "./src/db/schema.ts",
	dialect: "sqlite",
});
