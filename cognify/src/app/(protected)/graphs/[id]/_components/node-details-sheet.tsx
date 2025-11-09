"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/trpc/react";
import { useNodeDetailsStream } from "@/hooks/useNodeDetailsStream";
import type { GraphNode } from "@/hooks/useGraphStream";

interface NodeDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graphId: string;
  graphName: string;
  selectedNodeId: string | null;
  selectedNodeLabel: string;
  nodes: GraphNode[];
  onNavigateToNode: (nodeId: string, nodeLabel: string) => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  hasRelatedNodes: boolean;
}

export function NodeDetailsSheet({
  open,
  onOpenChange,
  graphId,
  graphName,
  selectedNodeId,
  selectedNodeLabel,
  nodes,
  onNavigateToNode,
  onNavigatePrev,
  onNavigateNext,
  hasRelatedNodes,
}: NodeDetailsSheetProps) {
  // Check for cached content first
  const { data: cachedData, isLoading: isCheckingCache } =
    api.graphs.getNodeDetails.useQuery(
      {
        graphId,
        nodeId: selectedNodeId ?? "",
      },
      {
        enabled: !!selectedNodeId && open,
      },
    );

  // Streaming hook for generating new content
  const {
    content: streamedContent,
    relationships: streamedRelationships,
    isStreaming,
    error: streamError,
    startStream,
  } = useNodeDetailsStream(graphId, selectedNodeId ?? "", selectedNodeLabel);

  // Start streaming if no cached data
  useEffect(() => {
    if (!isCheckingCache && cachedData === null && open && selectedNodeId) {
      console.log("[NodeDetailsSheet] No cached data, starting stream");
      startStream();
    }
  }, [isCheckingCache, cachedData, open, selectedNodeId, startStream]);

  // Determine what to display
  const content = cachedData?.content ?? streamedContent;
  const relationships = cachedData?.relationships ?? streamedRelationships;
  const isLoading = isCheckingCache || (cachedData === null && isStreaming);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        key={selectedNodeId} 
        className="w-[600px] sm:max-w-[600px] overflow-y-auto"
      >
        <SheetHeader className="sticky top-0 bg-white">
          <SheetTitle>{selectedNodeLabel}</SheetTitle>
          <SheetDescription>
            Detailed explanation in the context of {graphName}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 flex flex-col">
          {streamError && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {streamError}
            </div>
          )}

          {isLoading && !content ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {isStreaming ? "Generating explanation..." : "Loading..."}
              </p>
            </div>
          ) : content ? (
            <>
              {/* Content */}
              <div className="prose prose-sm max-w-none h-full">
                <p className="whitespace-pre-wrap leading-relaxed pb-4">
                  {content}
                  {isStreaming && (
                    <span className="inline-block ml-1 w-2 h-4 bg-primary animate-pulse" />
                  )}
                </p>
              </div>

              {/* Related Nodes Navigation */}
              {relationships &&
                (relationships.incoming.length > 0 ||
                  relationships.outgoing.length > 0) && (
                  <div className="border-t mt-auto sticky bottom-0 pt-4 pb-4 bg-white">
                    <h3 className="mb-4 text-sm font-semibold">
                      Related Concepts
                    </h3>

                    {/* Incoming relationships */}
                    {relationships.incoming.length > 0 && (
                      <div className="mb-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Connected from:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {relationships.incoming.map((rel, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="cursor-pointer hover:bg-accent"
                              onClick={() => {
                                const node = nodes.find(
                                  (n) => n.label === rel.source,
                                );
                                if (node) {
                                  onNavigateToNode(node.id, node.label);
                                }
                              }}
                            >
                              {rel.source}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outgoing relationships */}
                    {relationships.outgoing.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Connected to:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {relationships.outgoing.map((rel, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="cursor-pointer hover:bg-accent"
                              onClick={() => {
                                const node = nodes.find(
                                  (n) => n.label === rel.target,
                                );
                                if (node) {
                                  onNavigateToNode(node.id, node.label);
                                }
                              }}
                            >
                              {rel.target}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Navigation buttons */}
                    <div className="mt-6 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onNavigatePrev}
                        disabled={!hasRelatedNodes}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onNavigateNext}
                        disabled={!hasRelatedNodes}
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

