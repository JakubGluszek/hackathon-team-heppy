"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CreateGraphForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"topic" | "upload">("topic");

  // Form state
  const [topic, setTopic] = useState("");
  const [inputText, setInputText] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const body =
        activeTab === "topic"
          ? { topic, name: name || undefined }
          : { inputText, name: name || undefined };

      const response = await fetch("/api/graphs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as {
        graphId?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create graph");
      }

      if (!data.graphId) {
        throw new Error("No graph ID returned");
      }

      toast.success("Graph created! Building now...");
      router.push(`/graphs/${data.graphId}`);
    } catch (error) {
      console.error("Error creating graph:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create graph",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isTopicValid = activeTab === "topic" && topic.trim().length > 0;
  const isUploadValid =
    activeTab === "upload" &&
    inputText.trim().length > 0 &&
    inputText.length <= 50000;
  const isFormValid = isTopicValid || isUploadValid;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Create Knowledge Graph</CardTitle>
        <CardDescription>
          Generate an interactive knowledge graph from a topic or text
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "topic" | "upload")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="topic">From Topic</TabsTrigger>
              <TabsTrigger value="upload">From Text</TabsTrigger>
            </TabsList>

            <TabsContent value="topic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Quantum Physics, Renaissance Art, Machine Learning"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-muted-foreground text-sm">
                  AI will generate educational content about this topic
                </p>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inputText">Text Content</Label>
                <Textarea
                  id="inputText"
                  placeholder="Paste your text here (max 50,000 characters)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isLoading}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-muted-foreground text-sm">
                  {inputText.length.toLocaleString()} / 50,000 characters
                  {inputText.length > 50000 && (
                    <span className="text-destructive ml-2 font-medium">
                      Text too long!
                    </span>
                  )}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="name">Graph Name (Optional)</Label>
            <Input
              id="name"
              placeholder="Leave empty to use topic or timestamp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={!isFormValid || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Graph...
              </>
            ) : (
              "Create Graph"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
