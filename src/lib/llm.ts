import { CreateMLCEngine } from "@mlc-ai/web-llm";

let enginePromise: Promise<any> | null = null;

export function hasWebGPU() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function getEngine() {
  if (!enginePromise) {
    enginePromise = CreateMLCEngine("Llama-3.2-1B-Instruct-q4f16_1-MLC");
  }
  return enginePromise;
}
