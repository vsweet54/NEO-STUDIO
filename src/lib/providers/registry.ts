export interface ModelCapabilities {
  supportsText: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
}

export interface ModelDefinition {
  id: string;
  name: string;
  providerId: string;
  capabilities: ModelCapabilities;
}

export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  status?: string;
}

// ⭐️ PASTIKAN BAGIAN INI ADA AGAR TIDAK ERROR ⭐️
export const PROVIDERS: ProviderConfig[] = [
  { id: "gemini", name: "Google Gemini", description: "Story, Script, Characters, Imagen 3" },
  { id: "nvidia", name: "NVIDIA NIM", description: "Enterprise Deep Reasoning, Mixtral" },
  { id: "cloudflare", name: "Cloudflare Workers AI", description: "Edge AI Inference" },
  { id: "groq", name: "Groq", description: "Ultra-Fast LPU Inference" },
  { id: "ollama", name: "Ollama (Cloud)", description: "Cloud-hosted open models" },
  { id: "openrouter", name: "OpenRouter", description: "Unified Multi-Model Gateway" }
];

export const VERIFIED_MODELS: ModelDefinition[] = [
  // --- GOOGLE GEMINI ---
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    providerId: "gemini",
    capabilities: { supportsText: true, supportsVision: true, supportsAudio: false }
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    providerId: "gemini",
    capabilities: { supportsText: true, supportsVision: true, supportsAudio: true }
  },

  // --- GROQ ---
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B (Groq)",
    providerId: "groq",
    capabilities: { supportsText: true, supportsVision: false, supportsAudio: false }
  },
  {
    id: "llama3-8b-8192",
    name: "Llama 3 8B (Groq)",
    providerId: "groq",
    capabilities: { supportsText: true, supportsVision: false, supportsAudio: false }
  },

  // --- NVIDIA NIM ---
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B (NVIDIA)",
    providerId: "nvidia",
    capabilities: { supportsText: true, supportsVision: false, supportsAudio: false }
  },
  {
    id: "mistralai/mixtral-8x7b-instruct-v0.1",
    name: "Mixtral 8x7B (NVIDIA)",
    providerId: "nvidia",
    capabilities: { supportsText: true, supportsVision: false, supportsAudio: false }
  },

  // --- CLOUDFLARE WORKERS AI ---
  {
    id: "@cf/meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B (CF)",
    providerId: "cloudflare",
    capabilities: { supportsText: true, supportsVision: false, supportsAudio: false }
  },

  // --- OLLAMA CLOUD ---
  {
    id: "glm-5.3-flash:cloud", 
    name: "GLM 5.3 Flash (Ollama Cloud)",
    providerId: "ollama",
    capabilities: { supportsText: true, supportsVision: false, supportsAudio: false }
  }
];