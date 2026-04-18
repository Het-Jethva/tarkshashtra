import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { buildTriageSystemPrompt, buildTriageUserPrompt } from "./triage.prompt.js";
import { triageResponseSchema, type TriageInvocationResult } from "./triage.types.js";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type AssistantMessagePart = {
  type?: unknown;
  text?: unknown;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | AssistantMessagePart[] | null;
    };
  }>;
};

function sanitizeEndpointBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function shouldUseGradientAgentEndpoint(): boolean {
  return Boolean(env.GRADIENT_AGENT_ENDPOINT && env.GRADIENT_AGENT_ACCESS_KEY);
}

function parseJsonBody(rawBody: string): ChatCompletionResponse | Record<string, unknown> {
  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as ChatCompletionResponse | Record<string, unknown>;
  } catch {
    return {
      rawBody,
    };
  }
}

function buildRequestHeaders(): Record<string, string> {
  const bearerToken = shouldUseGradientAgentEndpoint()
    ? env.GRADIENT_AGENT_ACCESS_KEY
    : env.GRADIENT_MODEL_ACCESS_KEY;

  return {
    Authorization: `Bearer ${bearerToken ?? ""}`,
    "Content-Type": "application/json",
  };
}

function parseModelTextContent(content: string | AssistantMessagePart[] | null | undefined): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const chunks: string[] = [];
    for (const part of content) {
      if (typeof part === "string") {
        chunks.push(part);
        continue;
      }

      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        chunks.push(part.text);
      }
    }

    return chunks.join("\n").trim();
  }

  return "";
}

function normalizeJsonPayload(candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("```") && !trimmed.endsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export class TriageService {
  async triageComplaint(complaintText: string): Promise<TriageInvocationResult> {
    const startedAt = Date.now();

    const usingAgentEndpoint = shouldUseGradientAgentEndpoint();
    const modelLabel = usingAgentEndpoint ? "gradient-agent" : env.GRADIENT_MODEL;

    if (!usingAgentEndpoint && !env.GRADIENT_MODEL_ACCESS_KEY) {
      return {
        ok: false,
        model: modelLabel,
        latencyMs: Date.now() - startedAt,
        rawOutput: {
          error: "GRADIENT_MODEL_ACCESS_KEY is missing",
        },
        errorMessage: "GRADIENT_MODEL_ACCESS_KEY is not configured",
      };
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: buildTriageSystemPrompt(),
      },
      {
        role: "user",
        content: buildTriageUserPrompt(complaintText),
      },
    ];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, env.GRADIENT_TIMEOUT_MS);

      const requestBody: Record<string, unknown> = {
        messages,
        temperature: 0.1,
        max_completion_tokens: 700,
      };

      if (usingAgentEndpoint) {
        requestBody.model = "ignored";
      } else {
        requestBody.model = env.GRADIENT_MODEL;
      }

      if (env.GRADIENT_ENFORCE_JSON_MODE) {
        requestBody.response_format = {
          type: "json_object",
        };
      }

      const endpointBaseUrl = usingAgentEndpoint
        ? sanitizeEndpointBaseUrl(env.GRADIENT_AGENT_ENDPOINT ?? "")
        : sanitizeEndpointBaseUrl(env.GRADIENT_BASE_URL);
      const endpointPath = usingAgentEndpoint
        ? "/api/v1/chat/completions?agent=true"
        : "/chat/completions";

      let response: globalThis.Response;
      try {
        response = await fetch(`${endpointBaseUrl}${endpointPath}`, {
          method: "POST",
          headers: buildRequestHeaders(),
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const responseBody = parseJsonBody(await response.text());

      if (!response.ok) {
        const latencyMs = Date.now() - startedAt;
        const messageFromApi =
          typeof responseBody === "object" &&
          responseBody &&
          "message" in responseBody &&
          typeof responseBody.message === "string"
            ? responseBody.message
            : undefined;

        return {
          ok: false,
          model: modelLabel,
          latencyMs,
          rawOutput: {
            status: response.status,
            statusText: response.statusText,
            response: responseBody as Record<string, unknown>,
          },
          errorMessage: messageFromApi ?? `Gradient API error ${response.status}`,
        };
      }

      const completion = responseBody as ChatCompletionResponse;
      const rawContent = completion.choices?.[0]?.message?.content;
      const textContent = parseModelTextContent(rawContent);
      if (!textContent) {
        const latencyMs = Date.now() - startedAt;
        return {
          ok: false,
          model: modelLabel,
          latencyMs,
          rawOutput: completion as unknown as Record<string, unknown>,
          errorMessage: "Model returned empty content",
        };
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(normalizeJsonPayload(textContent));
      } catch {
        const latencyMs = Date.now() - startedAt;
        return {
          ok: false,
          model: modelLabel,
          latencyMs,
          rawOutput: {
            completion,
            rawText: textContent,
          },
          errorMessage: "Model output is not valid JSON",
        };
      }

      const parsed = triageResponseSchema.safeParse(parsedJson);
      const latencyMs = Date.now() - startedAt;

      if (!parsed.success) {
        return {
          ok: false,
          model: modelLabel,
          latencyMs,
          rawOutput: {
            completion,
            parsedJson,
            validationErrors: parsed.error.flatten(),
          },
          errorMessage: "Model output failed schema validation",
        };
      }

      return {
        ok: true,
        model: modelLabel,
        latencyMs,
        data: parsed.data,
        rawOutput: completion as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : "Unknown triage error";

      logger.error("Triage request failed", { message, latencyMs });

      return {
        ok: false,
        model: modelLabel,
        latencyMs,
        rawOutput: {
          error: message,
        },
        errorMessage: message,
      };
    }
  }
}

export const triageService = new TriageService();
