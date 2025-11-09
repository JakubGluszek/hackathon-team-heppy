"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showLabels, setShowLabels] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  
  // Use ref instead of state to avoid re-renders on hover
  const hoveredNodeRef = useRef<string | null>(null);

  const { nodes, edges, status, statusMessage, error, summary } =
    useGraphStream(graphId);

  // Update dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    
    // Use ResizeObserver to handle sidebar collapse/expand
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  // Transform data for react-force-graph
  // Use useMemo to prevent unnecessary re-renders
  const graphData = React.useMemo(
    () => ({
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
    }),
    [nodes, edges],
  );

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

  // Memoized canvas rendering callbacks
  const nodeCanvasObjectCallback = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const nodeData = node;
      const label = nodeData.name as string;
      const fontSize = 12 / globalScale;
      const nodeSize = 8;
      const isHovered = hoveredNodeRef.current === nodeData.id;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(nodeData.x ?? 0, nodeData.y ?? 0, nodeSize, 0, 2 * Math.PI);
      ctx.fillStyle = (nodeData.color as string) ?? "#666";
      ctx.fill();

      // Add white border on hover
      if (isHovered) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Only draw label if showLabels is true OR node is hovered
      if (showLabels || isHovered) {
        ctx.font = `${fontSize}px Sans-Serif`;
        const textWidth = ctx.measureText(label).width;
        const bckgDimensions = [textWidth, fontSize].map(
          (n) => n + fontSize * 0.2,
        );

        const labelX = nodeData.x ?? 0;
        const labelY = (nodeData.y ?? 0) + nodeSize + fontSize * 0.8;

        // Draw background rectangle
        ctx.fillStyle = isHovered
          ? "rgba(0, 0, 0, 0.85)"
          : "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(
          labelX - (bckgDimensions[0] ?? 0) / 2,
          labelY - (bckgDimensions[1] ?? 0) / 2,
          bckgDimensions[0] ?? 0,
          bckgDimensions[1] ?? 0,
        );

        // Draw label text
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.fillText(label, labelX, labelY);
      }
    },
    [showLabels],
  );

  const nodePointerAreaPaintCallback = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      const nodeSize = 8;

      // Draw larger circle for easier clicking
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, nodeSize * 1.5, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  const onNodeHoverCallback = useCallback((node: any) => {
    hoveredNodeRef.current = node ? (node.id as string) : null;
  }, []);

  const linkCanvasObjectCallback = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (!showEdgeLabels) return;

      const linkData = link;
      const label = linkData.label as string;
      if (!label) return;

      const fontSize = 9 / globalScale;
      ctx.font = `${fontSize}px Sans-Serif`;

      // Calculate middle position
      const start = {
        x: linkData.source.x ?? 0,
        y: linkData.source.y ?? 0,
      };
      const end = {
        x: linkData.target.x ?? 0,
        y: linkData.target.y ?? 0,
      };
      const middleX = start.x + (end.x - start.x) / 2;
      const middleY = start.y + (end.y - start.y) / 2;

      // Measure text
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth, fontSize].map(
        (n) => n + fontSize * 0.15,
      );

      // Draw background
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(
        middleX - (bckgDimensions[0] ?? 0) / 2,
        middleY - (bckgDimensions[1] ?? 0) / 2,
        bckgDimensions[0] ?? 0,
        bckgDimensions[1] ?? 0,
      );

      // Draw text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(180, 180, 180, 0.95)";
      ctx.fillText(label, middleX, middleY);
    },
    [showEdgeLabels],
  );

  return (
    <div className="bg-background flex flex-col w-full h-full">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="flex items-center justify-between px-4 py-4">
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
        <div className="px-4 py-2">
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

            <div className="ml-4 flex items-center gap-2">
              <Button
                variant={showLabels ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLabels(!showLabels)}
              >
                Node Labels
              </Button>
              <Button
                variant={showEdgeLabels ? "default" : "outline"}
                size="sm"
                onClick={() => setShowEdgeLabels(!showEdgeLabels)}
              >
                Edge Labels
              </Button>
            </div>

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
      <div ref={containerRef} className="flex-1 overflow-hidden min-h-0">
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
              nodeRelSize={8}
              nodeCanvasObject={nodeCanvasObjectCallback}
              nodePointerAreaPaint={nodePointerAreaPaintCallback}
              onNodeHover={onNodeHoverCallback}
              linkLabel="label"
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkCurvature={0.15}
              linkColor={() => "rgba(150, 150, 150, 0.3)"}
              linkWidth={1}
              linkCanvasObjectMode={() => (showEdgeLabels ? "after" : undefined)}
              linkCanvasObject={linkCanvasObjectCallback}
              enableZoomInteraction={true}
              enablePanInteraction={true}
              enableNodeDrag={true}
              cooldownTime={15000}
              cooldownTicks={100}
              onEngineStop={() => {
                // Keep simulation warm to prevent restarts
                if (graphRef.current) {
                  graphRef.current.d3ReheatSimulation?.();
                }
              }}
              d3AlphaMin={0.001}
              d3AlphaDecay={0.0228}
              d3VelocityDecay={0.4}
              warmupTicks={100}
              d3Force="charge"
              d3ForceStrength={-120}
            />
          </div>
        )}
      </div>

      {/* Summary */}
      {summary && status === "complete" && (
        <div className="bg-card border-t">
          <div className="px-4 py-3">
            <p className="text-muted-foreground text-center text-sm">
              Graph complete: {summary.nodes} nodes, {summary.edges} edges
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
