import OpenAI from "openai";
import { env } from "@/env";
import {
  extractJsonFromText,
  generateNodeId,
  limitPredicateLength,
} from "./graph-utils";
import {
  TRIPLE_EXTRACTION_SYSTEM_PROMPT,
  getTripleExtractionUserPrompt,
} from "./prompts";

// Initialize OpenAI client with timeout
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY as string,
  timeout: 30000, // 30 second timeout
});

// Constants
const SOFT_NODE_CAP = 300;
const HARD_NODE_CAP = 500;
const MAX_PREDICATE_WORDS = 3;

// Type definitions for streaming events
export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "node"; node: GraphNode }
  | { type: "edge"; edge: GraphEdge }
  | { type: "complete"; summary: { nodes: number; edges: number } }
  | { type: "error"; message: string };

export interface GraphNode {
  id: string;
  label: string;
  group: "extracted";
  weight: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  type: "extracted" | "inferred";
  confidence?: number;
}

export interface Triple {
  subject: string;
  predicate: string;
  object: string;
}

/**
 * Validate a triple object.
 * Ensures all required fields are present and not empty, and prevents self-references.
 */
function validateTriple(triple: unknown): triple is Triple {
  if (typeof triple !== "object" || triple === null) {
    return false;
  }

  const t = triple as Record<string, unknown>;

  // Check required fields exist and are non-empty strings
  if (
    typeof t.subject !== "string" ||
    typeof t.predicate !== "string" ||
    typeof t.object !== "string"
  ) {
    return false;
  }

  if (
    t.subject.trim().length === 0 ||
    t.predicate.trim().length === 0 ||
    t.object.trim().length === 0
  ) {
    return false;
  }

  // Prevent self-references
  if (t.subject.toLowerCase().trim() === t.object.toLowerCase().trim()) {
    return false;
  }

  return true;
}

/**
 * Extract triples from a single text chunk using OpenAI.
 * Returns array of validated triples.
 */
export async function extractTriplesFromChunk(
  chunk: string,
): Promise<Triple[]> {
  try {
    console.log(
      `[Pipeline] Calling OpenAI for chunk (${chunk.length} chars)...`,
    );
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: TRIPLE_EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: getTripleExtractionUserPrompt(chunk),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 8192,
    });

    const duration = Date.now() - startTime;
    console.log(`[Pipeline] OpenAI responded in ${duration}ms`);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn("[Pipeline] No content in LLM response");
      return [];
    }

    // Parse JSON with robust extraction
    const json = extractJsonFromText(content);
    if (!json) {
      console.warn("[Pipeline] Could not extract JSON from LLM response");
      return [];
    }

    // Extract triples array
    let triplesArray: unknown[] = [];
    if (typeof json === "object" && json !== null) {
      const obj = json as Record<string, unknown>;
      if (Array.isArray(obj.triples)) {
        triplesArray = obj.triples;
      } else if (Array.isArray(json)) {
        // Handle case where response is directly an array
        triplesArray = json;
      }
    } else if (Array.isArray(json)) {
      triplesArray = json;
    }

    console.log(`[Pipeline] Extracted ${triplesArray.length} raw triples`);

    // Validate and filter triples
    const validTriples = triplesArray.filter(validateTriple);

    // Apply predicate length limit to all triples
    const processedTriples = validTriples.map((triple) => ({
      subject: triple.subject.trim(),
      predicate: limitPredicateLength(
        triple.predicate.trim(),
        MAX_PREDICATE_WORDS,
      ),
      object: triple.object.trim(),
    }));

    const invalidCount = triplesArray.length - validTriples.length;
    if (invalidCount > 0) {
      console.warn(
        `[Pipeline] Filtered ${invalidCount} invalid triples from chunk (${validTriples.length} valid)`,
      );
    }

    console.log(
      `[Pipeline] Returning ${processedTriples.length} valid triples`,
    );
    return processedTriples;
  } catch (error) {
    console.error("Error extracting triples from chunk:", error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("rate_limit")) {
        throw new Error("OpenAI rate limit exceeded. Please try again later.");
      }
      if (error.message.includes("timeout")) {
        throw new Error("OpenAI request timed out. Please try again.");
      }
    }

    // Return empty array to continue processing other chunks
    return [];
  }
}

/**
 * Parse triples incrementally from streaming text.
 * Looks for complete triple objects in the accumulated content.
 */
function parseStreamingTriples(text: string): Triple[] {
  const triples: Triple[] = [];

  // Look for individual triple objects in the form: {"subject":"...","predicate":"...","object":"..."}
  // Use a more forgiving regex that captures complete objects
  const tripleRegex =
    /\{\s*"subject"\s*:\s*"([^"]+)"\s*,\s*"predicate"\s*:\s*"([^"]+)"\s*,\s*"object"\s*:\s*"([^"]+)"\s*\}/g;

  let match;
  while ((match = tripleRegex.exec(text)) !== null) {
    const triple = {
      subject: match[1]?.trim() ?? "",
      predicate: match[2]?.trim() ?? "",
      object: match[3]?.trim() ?? "",
    };

    if (triple.subject && triple.predicate && triple.object) {
      triples.push(triple);
    }
  }

  return triples;
}

/**
 * Extract triples from text using OpenAI streaming for real-time processing.
 * Yields triples as they're discovered in the stream.
 */
async function* extractTriplesStreaming(text: string): AsyncGenerator<Triple> {
  try {
    console.log(
      `[Pipeline] Starting streaming extraction (${text.length} chars)...`,
    );
    const startTime = Date.now();

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: TRIPLE_EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: getTripleExtractionUserPrompt(text),
        },
      ],
      // IMPORTANT: Do NOT use response_format json_object - it blocks streaming!
      temperature: 0.2,
      max_tokens: 8192,
      stream: true,
    });

    let accumulatedContent = "";
    const yieldedTriples = new Set<string>(); // Track yielded triples to avoid duplicates

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        accumulatedContent += content;

        // Try to parse complete triples from accumulated content
        const foundTriples = parseStreamingTriples(accumulatedContent);

        // Yield any new triples we haven't seen before
        for (const triple of foundTriples) {
          const tripleKey = `${triple.subject}|${triple.predicate}|${triple.object}`;

          if (!yieldedTriples.has(tripleKey) && validateTriple(triple)) {
            yieldedTriples.add(tripleKey);
            console.log(
              `[Pipeline] Yielding triple: ${triple.subject} -> ${triple.predicate} -> ${triple.object}`,
            );
            yield {
              subject: triple.subject.trim(),
              predicate: limitPredicateLength(
                triple.predicate.trim(),
                MAX_PREDICATE_WORDS,
              ),
              object: triple.object.trim(),
            };
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Pipeline] Streaming completed in ${duration}ms, ${yieldedTriples.size} triples yielded`,
    );
  } catch (error) {
    console.error("Error in streaming extraction:", error);
    if (error instanceof Error) {
      if (error.message.includes("rate_limit")) {
        throw new Error("OpenAI rate limit exceeded. Please try again later.");
      }
      if (error.message.includes("timeout")) {
        throw new Error("OpenAI request timed out. Please try again.");
      }
    }
    throw error;
  }
}

/**
 * Build a knowledge graph from text by extracting triples.
 * Yields streaming events as nodes and edges are discovered.
 */
export async function* buildGraphFromText(
  text: string,
): AsyncGenerator<StreamEvent> {
  // Maps to track unique nodes and edges
  const nodesMap = new Map<string, GraphNode>();
  const edgesMap = new Map<string, GraphEdge>();

  let totalNodesEmitted = 0;
  let softCapWarningEmitted = false;

  try {
    yield {
      type: "status",
      message: "Starting graph generation...",
    };

    console.log(
      `[Pipeline] Starting extraction for ${text.length} chars, ~${text.split(/\s+/).length} words`,
    );

    yield {
      type: "status",
      message: "Analyzing text and extracting relationships...",
    };

    // Stream triples as they're extracted
    for await (const triple of extractTriplesStreaming(text)) {
      // Check hard cap
      if (totalNodesEmitted >= HARD_NODE_CAP) {
        yield {
          type: "status",
          message: `Hard node limit reached (${HARD_NODE_CAP}). Stopping extraction.`,
        };
        break;
      }

      // Create nodes for subject and object
      const subjectId = generateNodeId(triple.subject);
      const objectId = generateNodeId(triple.object);

      // Add subject node if not already present
      if (!nodesMap.has(subjectId)) {
        const node: GraphNode = {
          id: subjectId,
          label: triple.subject,
          group: "extracted",
          weight: 1,
        };
        nodesMap.set(subjectId, node);
        yield { type: "node", node };
        totalNodesEmitted++;

        // Check soft cap
        if (totalNodesEmitted >= SOFT_NODE_CAP && !softCapWarningEmitted) {
          yield {
            type: "status",
            message: `Warning: Approaching node limit (${totalNodesEmitted}/${SOFT_NODE_CAP}). Graph may become slow.`,
          };
          softCapWarningEmitted = true;
        }

        // Check hard cap
        if (totalNodesEmitted >= HARD_NODE_CAP) {
          yield {
            type: "status",
            message: `Hard node limit reached (${HARD_NODE_CAP}). Stopping extraction.`,
          };
          break;
        }
      }

      // Add object node if not already present
      if (!nodesMap.has(objectId)) {
        const node: GraphNode = {
          id: objectId,
          label: triple.object,
          group: "extracted",
          weight: 1,
        };
        nodesMap.set(objectId, node);
        yield { type: "node", node };
        totalNodesEmitted++;

        // Check hard cap again
        if (totalNodesEmitted >= HARD_NODE_CAP) {
          yield {
            type: "status",
            message: `Hard node limit reached (${HARD_NODE_CAP}). Stopping extraction.`,
          };
          break;
        }
      }

      // Create edge
      const edgeKey = `${subjectId}-${triple.predicate}-${objectId}`;
      if (!edgesMap.has(edgeKey)) {
        const edge: GraphEdge = {
          source: subjectId,
          target: objectId,
          relation: triple.predicate,
          type: "extracted",
          confidence: 0.9,
        };
        edgesMap.set(edgeKey, edge);
        yield { type: "edge", edge };
      }
    }

    // Emit completion event
    console.log(
      `[Pipeline] Complete: ${nodesMap.size} nodes, ${edgesMap.size} edges`,
    );
    yield {
      type: "complete",
      summary: {
        nodes: nodesMap.size,
        edges: edgesMap.size,
      },
    };
  } catch (error) {
    console.error("Error in buildGraphFromText:", error);
    yield {
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during graph generation",
    };
  }
}
