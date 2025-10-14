import { CreateMLCEngine, type InitProgressReport } from "@mlc-ai/web-llm";

let enginePromise: Promise<any> | null = null;

export function hasWebGPU() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function getEngine() {
  if (!enginePromise) {
    enginePromise = CreateMLCEngine("Llama-3.2-1B-Instruct-q4f16_1-MLC"), {
      initProgressCallback: (p: InitProgressReport) => {
        const pct = Math.round(((p.progress ?? 0) * 100));
        console.log("webllm init:", `${pct}%`, p.text);
      },
    }
  };
  return enginePromise;
}
