import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { WordData } from "@/lib/types";
import TrialApp from "./trial-app";

function loadWords(): Record<string, WordData[]> {
  const dataDir = join(process.cwd(), "public", "data");
  const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));

  const beginner: WordData[] = [];
  const intermediate: WordData[] = [];

  for (const file of files) {
    const raw = readFileSync(join(dataDir, file), "utf-8");
    const word: WordData = JSON.parse(raw);
    if (word.level === "beginner") beginner.push(word);
    else intermediate.push(word);
  }

  return { beginner, intermediate };
}

export default function TrialPage() {
  const words = loadWords();
  return <TrialApp words={words} />;
}
