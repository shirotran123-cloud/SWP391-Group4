/**
 * Provider-specific JSON Schema adaptation.
 *
 * The canonical schemas in code-review.schema.ts are full JSON Schema, but the
 * structured-output APIs accept different subsets:
 *  - Google Gemini `responseSchema` uses an OpenAPI-style Schema object and rejects
 *    unknown fields such as `additionalProperties`.
 *  - OpenAI strict json_schema mode has historically rejected some validation
 *    keywords (e.g. `minimum` / `maximum`).
 *
 * Range keywords are therefore stripped before sending; numeric ranges are still
 * enforced locally by review-response.validator.ts after the response arrives.
 */

type JsonSchema = Record<string, unknown>;

const RANGE_KEYWORDS = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"];

function stripKeys(schema: unknown, keys: string[]): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => stripKeys(item, keys));
  }
  if (schema && typeof schema === "object") {
    const out: JsonSchema = {};
    for (const [key, value] of Object.entries(schema as JsonSchema)) {
      if (keys.includes(key)) continue;
      // `properties` maps user field names -> schemas; never strip a field just
      // because its *name* collides with a keyword (e.g. a property called "minimum").
      if (key === "properties" && value && typeof value === "object") {
        const props: JsonSchema = {};
        for (const [propName, propSchema] of Object.entries(value as JsonSchema)) {
          props[propName] = stripKeys(propSchema, keys);
        }
        out[key] = props;
        continue;
      }
      out[key] = stripKeys(value, keys);
    }
    return out;
  }
  return schema;
}

export function adaptSchemaForOpenAI(schema: JsonSchema): JsonSchema {
  // Strict mode requires additionalProperties:false on every object, so keep it.
  return stripKeys(schema, RANGE_KEYWORDS) as JsonSchema;
}

export function adaptSchemaForGemini(schema: JsonSchema): JsonSchema {
  return stripKeys(schema, [...RANGE_KEYWORDS, "additionalProperties", "$schema"]) as JsonSchema;
}
