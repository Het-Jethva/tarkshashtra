import { z } from "zod";

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url(),
  GRADIENT_AGENT_ENDPOINT: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  }, z.url().optional()),
  GRADIENT_AGENT_ACCESS_KEY: optionalNonEmptyString,
  GRADIENT_AGENT_CHATBOT_ID: optionalNonEmptyString,
  GRADIENT_MODEL_ACCESS_KEY: optionalNonEmptyString,
  GRADIENT_BASE_URL: z.url().default("https://inference.do-ai.run/v1"),
  GRADIENT_MODEL: z.string().min(1).default("llama3.3-70b-instruct"),
  GRADIENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  GRADIENT_ENFORCE_JSON_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  PROMPT_VERSION: z.string().default("v1"),
  ENABLE_SLA_JOB: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
