import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Email configuration
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.string().transform((str) => parseInt(str, 10)),
    SMTP_SECURE: z.string().transform((str) => str === "true"),
    SMTP_USER: z.string().min(1),
    SMTP_PASS: z.string().min(1),
    SMTP_FROM: z.string().email(),

    // Database
    DATABASE_URL: z.string().url(),

    // Auth
    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(1),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_NAME: z.string().min(1),
  },

  runtimeEnv: {
    // Email configuration
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,

    // Database
    DATABASE_URL: process.env.DATABASE_URL,

    // Auth
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,

    // Public variables
    NEXT_PUBLIC_APP_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_NAME: process.env.NEXT_PUBLIC_NAME,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
