"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Lightbulb, Clock, Trash2 } from "lucide-react";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export function GraphsList() {
  const utils = api.useUtils();
  const { data: graphs, isLoading } = api.graphs.list.useQuery();
  const deleteMutation = api.graphs.delete.useMutation({
    onSuccess: () => {
      toast.success("Graph deleted");
      void utils.graphs.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = (e: React.MouseEvent, graphId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirm("Are you sure you want to delete this graph?")) {
      deleteMutation.mutate({ id: graphId });
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>My Graphs</CardTitle>
          <CardDescription>Your recent knowledge graphs</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!graphs || graphs.length === 0) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>My Graphs</CardTitle>
          <CardDescription>Your recent knowledge graphs</CardDescription>
        </CardHeader>
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">
            No graphs yet. Create your first one above!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>My Graphs</CardTitle>
        <CardDescription>
          {graphs.length} {graphs.length === 1 ? "graph" : "graphs"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {graphs.map((graph) => (
            <Link key={graph.id} href={`/graphs/${graph.id}`} className="block">
              <div className="group hover:border-primary relative rounded-lg border p-4 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {graph.sourceType === "topic" ? (
                        <Lightbulb className="text-muted-foreground h-4 w-4" />
                      ) : (
                        <FileText className="text-muted-foreground h-4 w-4" />
                      )}
                      <h3 className="leading-none font-medium">{graph.name}</h3>
                    </div>

                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(graph.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        graph.status === "complete"
                          ? "default"
                          : graph.status === "error"
                            ? "destructive"
                            : graph.status === "building"
                              ? "secondary"
                              : "outline"
                      }
                    >
                      {graph.status}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 transition group-hover:opacity-100"
                      onClick={(e) => handleDelete(e, graph.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
