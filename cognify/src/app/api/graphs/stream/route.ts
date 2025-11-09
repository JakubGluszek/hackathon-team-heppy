import { type NextRequest } from "next/server";
import { db } from "@/server/db";
import { graphs } from "@/server/db/schema";
import { auth } from "@/server/better-auth";
import { eq } from "drizzle-orm";
import {
  buildGraphFromText,
  type GraphNode,
  type GraphEdge,
} from "@/lib/graph-pipeline";

// Helper to send SSE event
function sendEvent(
  controller: ReadableStreamDefaultController,
  eventType: string,
  data: unknown,
) {
  const encoder = new TextEncoder();
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(message));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const graphId = searchParams.get("graphId");

  if (!graphId) {
    return new Response(
      JSON.stringify({ error: "Missing graphId parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    // 1. Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;

    // 2. Fetch graph and verify ownership
    const [graph] = await db
      .select()
      .from(graphs)
      .where(eq(graphs.id, graphId))
      .limit(1);

    if (!graph) {
      return new Response(JSON.stringify({ error: "Graph not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (graph.userId !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Update graph status to building
    await db
      .update(graphs)
      .set({ status: "building" })
      .where(eq(graphs.id, graphId));

    // 4. Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        // Maps to accumulate nodes and edges for final save
        const nodesMap = new Map<string, GraphNode>();
        const edgesMap = new Map<string, GraphEdge>();

        try {
          // Get the input text for processing
          const inputText = graph.inputText;

          if (!inputText) {
            sendEvent(controller, "error", {
              message: "No input text found for graph",
            });
            await db
              .update(graphs)
              .set({ status: "error" })
              .where(eq(graphs.id, graphId));
            controller.close();
            return;
          }

          // Process the text and stream events
          for await (const event of buildGraphFromText(inputText)) {
            // Forward all events to the client
            switch (event.type) {
              case "status":
                sendEvent(controller, "status", {
                  message: event.message,
                });
                break;

              case "node":
                // Add to map for deduplication
                nodesMap.set(event.node.id, event.node);
                sendEvent(controller, "node", { node: event.node });
                break;

              case "edge":
                // Add to map for deduplication
                const edgeKey = `${event.edge.source}-${event.edge.relation}-${event.edge.target}`;
                edgesMap.set(edgeKey, event.edge);
                sendEvent(controller, "edge", { edge: event.edge });
                break;

              case "complete":
                // Save final graph to database
                const graphJson = {
                  nodes: Array.from(nodesMap.values()),
                  edges: Array.from(edgesMap.values()),
                };

                await db
                  .update(graphs)
                  .set({
                    status: "complete",
                    graphJson,
                  })
                  .where(eq(graphs.id, graphId));

                sendEvent(controller, "complete", {
                  summary: event.summary,
                });
                break;

              case "error":
                // Update graph status to error
                await db
                  .update(graphs)
                  .set({ status: "error" })
                  .where(eq(graphs.id, graphId));

                sendEvent(controller, "error", {
                  message: event.message,
                });
                break;
            }
          }

          controller.close();
        } catch (error) {
          console.error("Error in stream:", error);

          // Update graph status to error
          await db
            .update(graphs)
            .set({ status: "error" })
            .where(eq(graphs.id, graphId));

          sendEvent(controller, "error", {
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred during graph generation",
          });

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error setting up stream:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
