"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize,
  AlertCircle,
} from "lucide-react";
import {
  useGraphStream,
  type GraphEdge,
  type GraphNode,
} from "@/hooks/useGraphStream";
import type { ForceGraphMethods } from "react-force-graph-2d";

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="text-muted-foreground h-12 w-12 animate-spin" />
    </div>
  ),
});

interface GraphViewerProps {
  graphId: string;
  graphName: string;
  initialStatus?: string; // Made optional since we don't use it
}

export function GraphViewer({ graphId, graphName }: GraphViewerProps) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphEdge> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const { nodes, edges, status, statusMessage, error, summary } =
    useGraphStream(graphId);

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth - 64, // Account for padding
        height: window.innerHeight - 200, // Account for header
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Transform data for react-force-graph
  const graphData = {
    nodes: nodes.map((node) => ({
      id: node.id,
      name: node.label,
      val: node.weight || 1,
      group: node.group,
    })),
    links: edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      label: edge.relation,
      type: edge.type,
    })),
  };

  const handleZoomIn = () => {
    if (graphRef.current?.zoom) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.2, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current?.zoom) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.2, 400);
    }
  };

  const handleResetView = () => {
    if (graphRef.current?.zoomToFit) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "complete":
        return "default";
      case "building":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="bg-background flex h-screen flex-col">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{graphName}</h1>
              <p className="text-muted-foreground text-sm">
                {nodes.length} nodes · {edges.length} edges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={getStatusColor()}>{status}</Badge>

            {status === "building" && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{statusMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetView}>
              <Maximize className="mr-2 h-4 w-4" />
              Reset View
            </Button>

            {status === "building" && nodes.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <Progress value={(nodes.length / 300) * 100} className="w-32" />
                <span className="text-muted-foreground text-xs">
                  {nodes.length} / ~300 nodes
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="flex flex-col items-center gap-4 pt-6">
                <AlertCircle className="text-destructive h-12 w-12" />
                <div className="text-center">
                  <h3 className="mb-2 font-semibold">Error Loading Graph</h3>
                  <p className="text-muted-foreground text-sm">{error}</p>
                </div>
                <Link href="/">
                  <Button variant="outline">Back to Home</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : nodes.length === 0 && status !== "complete" ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Loader2 className="text-primary mx-auto mb-4 h-12 w-12 animate-spin" />
              <p className="text-muted-foreground">{statusMessage}</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
            <ForceGraph2D
              // @ts-expect-error - ForceGraph2D is not typed
              ref={graphRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeLabel="name"
              nodeAutoColorBy="group"
              nodeCanvasObject={(node, ctx, globalScale) => {
                const nodeData = node;
                const label = nodeData.name as string;
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;

                // Draw node circle
                const nodeSize = (nodeData.val as number) ?? 4;
                ctx.beginPath();
                ctx.arc(
                  nodeData.x ?? 0,
                  nodeData.y ?? 0,
                  nodeSize,
                  0,
                  2 * Math.PI,
                );
                ctx.fillStyle = (nodeData.color as string) ?? "#666";
                ctx.fill();

                // Draw label
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                ctx.fillText(
                  label,
                  nodeData.x ?? 0,
                  (nodeData.y ?? 0) + nodeSize + fontSize,
                );
              }}
              linkLabel="label"
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              linkCurvature={0.1}
              linkColor={() => "rgba(150, 150, 150, 0.4)"}
              linkWidth={1.5}
              enableZoomInteraction={true}
              enablePanInteraction={true}
              cooldownTime={3000}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          </div>
        )}
      </div>

      {/* Summary */}
      {summary && status === "complete" && (
        <div className="bg-card border-t">
          <div className="container mx-auto px-4 py-3">
            <p className="text-muted-foreground text-center text-sm">
              Graph complete: {summary.nodes} nodes, {summary.edges} edges
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
