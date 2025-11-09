"use client";

import { useEffect, useState, useRef } from "react";

interface Relationships {
  incoming: Array<{ source: string; relation: string }>;
  outgoing: Array<{ relation: string; target: string }>;
}

interface UseNodeDetailsStreamResult {
  content: string;
  relationships: Relationships | null;
  isStreaming: boolean;
  error: string | null;
  startStream: () => void;
}

export function useNodeDetailsStream(
  graphId: string,
  nodeId: string,
  nodeLabel: string,
): UseNodeDetailsStreamResult {
  const [content, setContent] = useState<string>("");
  const [relationships, setRelationships] = useState<Relationships | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const hasStartedRef = useRef(false);
  const currentNodeIdRef = useRef<string>(nodeId);

  // Reset state when node changes
  useEffect(() => {
    if (currentNodeIdRef.current !== nodeId) {
      console.log("[useNodeDetailsStream] Node changed, resetting state");
      currentNodeIdRef.current = nodeId;
      hasStartedRef.current = false;
      setContent("");
      setRelationships(null);
      setError(null);
      setIsStreaming(false);
      
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [nodeId]);

  const startStream = () => {
    if (hasStartedRef.current || !graphId || !nodeId || !nodeLabel) return;

    hasStartedRef.current = true;
    setIsStreaming(true);
    setError(null);
    setContent("");
    setRelationships(null);

    const url = `/api/nodes/generate?graphId=${encodeURIComponent(graphId)}&nodeId=${encodeURIComponent(nodeId)}&nodeLabel=${encodeURIComponent(nodeLabel)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    console.log("[useNodeDetailsStream] Starting stream for node:", nodeId);

    eventSource.addEventListener("status", (e) => {
      const data = JSON.parse(e.data as string) as { message: string };
      console.log("[useNodeDetailsStream] Status:", data.message);
    });

    eventSource.addEventListener("content", (e) => {
      const data = JSON.parse(e.data as string) as { text: string };
      setContent((prev) => prev + data.text);
    });

    eventSource.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data as string) as {
        relationships: Relationships;
      };
      setRelationships(data.relationships);
      setIsStreaming(false);
      eventSource.close();
      console.log("[useNodeDetailsStream] Stream complete");
    });

    eventSource.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data as string;
      if (data) {
        try {
          const parsedData = JSON.parse(data) as { message: string };
          setError(parsedData.message);
        } catch {
          setError("Failed to generate content");
        }
      } else {
        setError("Connection error");
      }
      setIsStreaming(false);
      eventSource.close();
      console.error("[useNodeDetailsStream] Error:", error);
    });

    eventSource.onerror = () => {
      setError("Connection failed");
      setIsStreaming(false);
      eventSource.close();
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    content,
    relationships,
    isStreaming,
    error,
    startStream,
  };
}

