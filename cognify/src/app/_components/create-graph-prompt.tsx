"use client";

import { useState, type FormEventHandler } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputModelSelect,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
} from "./ai-prompt-input";
import { SparklesIcon, FileTextIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const models = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
];

type InputMode = "topic" | "text";

export function CreateGraphPrompt() {
  const router = useRouter();
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<string>(models[0]!.id);
  const [mode, setMode] = useState<InputMode>("topic");

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!text.trim()) {
      return;
    }

    // Validate text mode
    if (mode === "text" && text.length > 50000) {
      toast.error("Text is too long. Maximum 50,000 characters.");
      return;
    }
    if (mode === "topic" && text.length > 1000) {
      toast.error("Topic is too long. Maximum 1,000 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const body =
        mode === "topic"
          ? { topic: text.trim() }
          : { inputText: text.trim() };

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
      setText("");
      router.push(`/graphs/${data.graphId}`);
    } catch (error) {
      console.error("Error creating graph:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create graph",
      );
      setIsLoading(false);
    }
  };

  const placeholder =
    mode === "topic"
      ? "What would you like to learn about? (e.g., Quantum Physics, Renaissance Art, Machine Learning)"
      : "Paste your text here (max 50,000 characters)...";

  const isTextTooLong = mode === "text" ? text.length > 50000 : text.length > 1000;

  return (
    <div className="w-full">
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea
          onChange={(e) => setText(e.target.value)}
          value={text}
          placeholder={placeholder}
          disabled={isLoading}
        />
        <PromptInputToolbar>
          <PromptInputTools>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (value) setMode(value as InputMode);
              }}
              className="gap-0"
            >
              <ToggleGroupItem
                value="topic"
                aria-label="Topic mode"
                className="gap-1.5 data-[state=on]:bg-accent"
              >
                <SparklesIcon size={14} />
                <span className="text-xs">Generate Topic</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="text"
                aria-label="Text mode"
                className="gap-1.5 data-[state=on]:bg-accent"
              >
                <FileTextIcon size={14} />
                <span className="text-xs">Knowledge Source</span>
              </ToggleGroupItem>
            </ToggleGroup>

              <div
                className={cn(
                  "text-xs text-muted-foreground px-2",
                  isTextTooLong && "text-destructive font-medium"
                )}
              >
                {text.length.toLocaleString()} / {mode === "text" ?  "50,000" : "1,000"}
              </div>

            <div className="flex-1" />

            <PromptInputModelSelect onValueChange={setModel} value={model}>
              <PromptInputModelSelectTrigger>
                <PromptInputModelSelectValue />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                {models.map((model) => (
                  <PromptInputModelSelectItem key={model.id} value={model.id}>
                    {model.name}
                  </PromptInputModelSelectItem>
                ))}
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>
          </PromptInputTools>
          <PromptInputSubmit
            disabled={!text.trim() || isLoading || isTextTooLong}
            isLoading={isLoading}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

