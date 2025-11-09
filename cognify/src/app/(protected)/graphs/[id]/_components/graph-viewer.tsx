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
import { useNodeSelection } from "@/hooks/useNodeSelection";
import { NodeDetailsSheet } from "./node-details-sheet";
import { useSidebar } from "@/components/ui/sidebar";

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
  graphIcon: string;
  graphName: string;
  initialStatus?: string; // Made optional since we don't use it
}

export function GraphViewer({ graphId, graphIcon, graphName }: GraphViewerProps) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphEdge> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showLabels, setShowLabels] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [initialCenter, setInitialCenter] = useState(true);
  
  // Use sidebar state to track when it toggles
  const { state: sidebarState } = useSidebar();
  
  // Use refs to avoid re-renders
  const hoveredNodeRef = useRef<string | null>(null);
  const currentZoomRef = useRef<number>(1);
  
  // Use state like the reference example - this is the correct way
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({
    nodes: [{
      id: "root",
      name: graphName,
      val: 3,
      group: "root",
      isRoot: true,
    }],
    links: []
  });
  
  const addedNodesRef = useRef(new Set<string>(['root']));
  const addedEdgesRef = useRef(new Set<string>());

  const { nodes, edges, status, statusMessage, error, summary } =
    useGraphStream(graphId);

  // Node selection hook
  const {
    selectedNodeId,
    selectedNodeLabel,
    sheetOpen,
    setSheetOpen,
    selectNode,
    navigateToRelatedNode,
    hasRelatedNodes,
  } = useNodeSelection(nodes, edges);

  // Simplified force calculation with sensible defaults
  const forceStrength = React.useMemo(() => {
    // Stronger base repulsion for better spacing
    return -300;
  }, []);

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        // Calculate width based on window width minus sidebar width
        // Sidebar: 16rem (256px) expanded, 3rem (48px) collapsed
        const sidebarWidth = sidebarState === "expanded" ? 360 : 48;
        const headerHeight = 16 * 4; // h-14 = 56px (header in layout)
        const graphHeaderHeight = containerRef.current.offsetTop; // Height of graph's own headers
        
        const width = window.innerWidth - sidebarWidth;
        const height = window.innerHeight - graphHeaderHeight - headerHeight;
        
        setDimensions({
          width,
          height,
        });
      }
    };

    // Update immediately
    updateDimensions();
    
    // Also update after sidebar transition completes (200ms + buffer)
    const timeoutId = setTimeout(updateDimensions, 300);
    
    window.addEventListener("resize", updateDimensions);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [sidebarState]);
  
  // Add nodes and edges incrementally - using functional setState like the reference example
  useEffect(() => {
    if (nodes.length === 0) return;
    
    // Check for new nodes
    const newNodes = nodes.filter(n => !addedNodesRef.current.has(n.id));
    
    // Check for new edges
    const newEdges = edges.filter(e => {
      const edgeKey = `${e.source}-${e.target}`;
      return !addedEdgesRef.current.has(edgeKey);
    });
    
    // If nothing new, skip
    if (newNodes.length === 0 && newEdges.length === 0) {
      return;
    }
    
    console.log('[GraphViewer] Adding', newNodes.length, 'nodes and', newEdges.length, 'edges');
    
    // Mark new nodes and edges as added
    newNodes.forEach(n => addedNodesRef.current.add(n.id));
    newEdges.forEach(e => addedEdgesRef.current.add(`${e.source}-${e.target}`));
    
    // Find floating nodes
    const nodesWithIncoming = new Set(edges.map(e => e.target));
    const floatingNodes = newNodes.filter(n => !nodesWithIncoming.has(n.id));
    floatingNodes.forEach(node => addedEdgesRef.current.add(`root-${node.id}`));
    
    // Use functional setState to create NEW arrays (not mutate existing)
    setGraphData(({ nodes: prevNodes, links: prevLinks }) => {
      // Transform new nodes
      const transformedNewNodes = newNodes.map(node => ({
        id: node.id,
        name: node.label,
        val: node.weight || 1,
        group: node.group,
      }));
      
      // Transform new edges
      const transformedNewEdges = newEdges.map(edge => ({
        source: edge.source,
        target: edge.target,
        label: edge.relation,
        type: edge.type,
      }));
      
      // Create root edges for floating nodes
      const rootEdges = floatingNodes.map(node => ({
        source: "root",
        target: node.id,
        label: "includes",
        type: "root",
      }));
      
      // Return NEW arrays
      return {
        nodes: [...prevNodes, ...transformedNewNodes],
        links: [...prevLinks, ...transformedNewEdges, ...rootEdges]
      };
    });
  }, [nodes, edges]);

  const handleZoomIn = () => {
    if (graphRef.current?.zoom) {
      const newZoom = graphRef.current.zoom() * 1.2;
      graphRef.current.zoom(newZoom, 400);
      currentZoomRef.current = newZoom;
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current?.zoom) {
      const newZoom = graphRef.current.zoom() / 1.2;
      graphRef.current.zoom(newZoom, 400);
      currentZoomRef.current = newZoom;
    }
  };

  const handleResetView = () => {
    if (graphRef.current?.zoomToFit) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  // Memoized node color function to prevent setState during render
  const getNodeColor = useCallback(
    (node: any) => {
      if (node.id === selectedNodeId) {
        return "#3b82f6"; // Blue for selected
      }
      if (node.group === "root") {
        return "#6366f1"; // Indigo for root
      }
      // Return default color based on group
      return node.color ?? "#64748b"; // Default gray
    },
    [selectedNodeId],
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      // Skip root node
      if (node.isRoot) return;

      // Set selected node and open sheet
      selectNode(node.id as string, node.name as string);
    },
    [selectNode],
  );

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
      const isHovered = hoveredNodeRef.current === nodeData.id;
      const isRoot = nodeData.isRoot === true;
      const isSelected = selectedNodeId === nodeData.id;
      
      // Always show labels for root node, otherwise check conditions
      const shouldShowLabel = showLabels || isHovered || isSelected || globalScale >= 2.5;
      
      if (shouldShowLabel) {
        // Simplified font sizing
        const baseFontSize = isRoot ? 14 : 9;
        const fontSize = baseFontSize / Math.sqrt(globalScale);
        
        ctx.font = `${isRoot ? 'bold ' : ''}${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Root node gets special styling
        if (isRoot) {
          ctx.fillStyle = "rgba(0, 0, 0, 1)";
        } else if (isSelected) {
          ctx.fillStyle = "rgba(59, 130, 246, 1)"; // Blue for selected
        } else {
          ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.9)" : "rgba(0, 0, 0, 0.7)";
        }
        
        // Draw label below the node
        const nodeSize = isRoot ? 10 : 5;
        const labelY = (nodeData.y ?? 0) + nodeSize + fontSize * 0.3;
        if (!isRoot) {
        ctx.fillText(label, nodeData.x ?? 0, labelY);
        }
      }
    },
    [showLabels, selectedNodeId],
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

  const onZoomCallback = useCallback((zoom: any) => {
    if (typeof zoom === 'object' && zoom.k) {
      currentZoomRef.current = zoom.k;
    }
  }, []);

  const linkCanvasObjectCallback = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (!showEdgeLabels) return;

      const linkData = link;
      const label = linkData.label as string;
      if (!label) return;
      
      // Skip root connection labels
      if (linkData.type === "root") return;

      // Simplified font sizing
      const fontSize = 5 / Math.sqrt(globalScale);
      
      ctx.font = `${fontSize}px Sans-Serif`;

      // Calculate middle position
      const middleX = linkData.source.x + (linkData.target.x - linkData.source.x) / 2;
      const middleY = linkData.source.y + (linkData.target.y - linkData.source.y) / 2;

      // Draw text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(100, 100, 100, 0.7)";
      ctx.fillText(label, middleX, middleY);
    },
    [showEdgeLabels],
  );

  return (
    <div className="bg-background flex flex-col w-full h-full overflow-hidden">
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
              <h1 className="text-2xl font-bold">{graphIcon} {graphName}</h1>
              <p className="text-muted-foreground text-sm">
                {nodes.length} nodes · {edges.length} edges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
          <div className="h-full w-full overflow-hidden">
            <ForceGraph2D
              // @ts-expect-error - ForceGraph2D ref type mismatch
              ref={graphRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeLabel="name"
              nodeColor={getNodeColor}
              nodeRelSize={1}
              onNodeClick={handleNodeClick}
              nodeCanvasObjectMode={() => "after"}
              nodeCanvasObject={nodeCanvasObjectCallback}
              nodePointerAreaPaint={nodePointerAreaPaintCallback}
              onNodeHover={onNodeHoverCallback}
              onZoom={onZoomCallback}
              linkLabel="label"
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkCurvature={0.15}
              linkColor={(link) => link.type === "root" ? "rgba(180, 180, 180, 0.3)" : "rgba(150, 150, 150, 0.3)"}
              linkWidth={(link) => link.type === "root" ? 0.5 : 1}
              linkCanvasObjectMode={() => (showEdgeLabels ? "after" : undefined)}
              linkCanvasObject={linkCanvasObjectCallback}
              enableZoomInteraction={true}
              enablePanInteraction={true}
              enableNodeDrag={false}
              cooldownTime={2000}
              cooldownTicks={100}
              onEngineStop={() => {
                // Simple fit to view on initial load
                if (initialCenter && graphRef.current?.zoomToFit) {
                  graphRef.current.zoomToFit(400, 80);
                  setInitialCenter(false);
                }
              }}
              d3AlphaMin={0.05}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.5}
              warmupTicks={0}
              d3Force="charge"
              d3ForceStrength={forceStrength}
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

      {/* Node Details Sheet */}
      <NodeDetailsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        graphId={graphId}
        graphName={graphName}
        selectedNodeId={selectedNodeId}
        selectedNodeLabel={selectedNodeLabel}
        nodes={nodes}
        onNavigateToNode={selectNode}
        onNavigatePrev={() => navigateToRelatedNode("prev")}
        onNavigateNext={() => navigateToRelatedNode("next")}
        hasRelatedNodes={hasRelatedNodes}
      />
    </div>
  );
}
