"use client";

import { useEffect, useState, useRef } from "react";

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  weight: number;
  description?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  type: string;
  confidence?: number;
}

export interface StreamStatus {
  message: string;
}

export interface StreamSummary {
  nodes: number;
  edges: number;
}

export interface UseGraphStreamResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  status: string;
  statusMessage: string;
  error: string | null;
  isConnected: boolean;
  summary: StreamSummary | null;
}

export function useGraphStream(graphId: string): UseGraphStreamResult {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [status, setStatus] = useState<string>("connecting");
  const [statusMessage, setStatusMessage] = useState<string>("Connecting...");
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [summary, setSummary] = useState<StreamSummary | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const nodeMapRef = useRef<Map<string, GraphNode>>(new Map());
  const edgeMapRef = useRef<Map<string, GraphEdge>>(new Map());

  useEffect(() => {
    if (!graphId) return;

    // Create EventSource connection
    const url = `/api/graphs/stream?graphId=${encodeURIComponent(graphId)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setStatus("connected");
      setStatusMessage("Connected");
    };

    eventSource.addEventListener("status", (e) => {
      const data = JSON.parse(e.data as string) as StreamStatus;
      setStatusMessage(data.message);
      setStatus("building");
    });

    eventSource.addEventListener("node", (e) => {
      const data = JSON.parse(e.data as string) as { node: GraphNode };
      const node = data.node;

      // Deduplicate nodes by ID
      if (!nodeMapRef.current.has(node.id)) {
        nodeMapRef.current.set(node.id, node);
        setNodes((prev) => [...prev, node]);
      }
    });

    eventSource.addEventListener("edge", (e) => {
      const data = JSON.parse(e.data as string) as { edge: GraphEdge };
      const edge = data.edge;

      // Deduplicate edges by source-target-relation-type
      const edgeKey = `${edge.source}-${edge.target}-${edge.relation}-${edge.type}`;
      if (!edgeMapRef.current.has(edgeKey)) {
        edgeMapRef.current.set(edgeKey, edge);
        setEdges((prev) => [...prev, edge]);
      }
    });

    eventSource.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data as string) as {
        summary: StreamSummary;
      };
      setSummary(data.summary);
      setStatus("complete");
      setStatusMessage("Graph generation complete!");
      eventSource.close();
      setIsConnected(false);
    });

    eventSource.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data as string;
      if (data) {
        try {
          const parsedData = JSON.parse(data) as { message: string };
          setError(parsedData.message);
          setStatusMessage(`Error: ${parsedData.message}`);
        } catch {
          setError("Unknown error occurred");
          setStatusMessage("Error: Unknown error occurred");
        }
      } else {
        setError("Unknown error occurred");
        setStatusMessage("Error: Unknown error occurred");
      }
      setStatus("error");
      eventSource.close();
      setIsConnected(false);
    });

    eventSource.onerror = () => {
      setError("Connection error");
      setStatus("error");
      setStatusMessage("Connection failed");
      eventSource.close();
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [graphId]);

  return {
    nodes,
    edges,
    status,
    statusMessage,
    error,
    isConnected,
    summary,
  };
}
