import { CreateGraphPrompt } from "@/app/_components/create-graph-prompt";
import Image from "next/image";

export default async function Home() {
  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="relative">
            <Image
              src="/cognify.webp"
              alt="Cognify"
              width={240}
              height={240}
              className="rounded-2xl"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Create Knowledge Graph</h1>
          <p className="text-muted-foreground mt-2 max-w-lg">
            Generate an interactive knowledge graph from a topic or your own text
          </p>
        </div>

        <CreateGraphPrompt />
      </div>
    </div>
  );
}
