import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { providerId, apiKey, accountId, baseUrl } = await req.json();

    if (!providerId || !apiKey) {
      return NextResponse.json({ error: 'Provider dan API Key wajib diisi' }, { status: 400 });
    }

    let url = '';
    let headers: Record<string, string> = { 'Authorization': `Bearer ${apiKey}` };

    if (providerId === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      headers = {}; 
    } else if (providerId === 'groq') {
      url = `https://api.groq.com/openai/v1/models`;
    } else if (providerId === 'nvidia') {
      url = `https://integrate.api.nvidia.com/v1/models`;
    } else if (providerId === 'openrouter') {
      url = `https://openrouter.ai/api/v1/models`;
    } else if (providerId === 'ollama') {
      const endpoint = baseUrl || 'https://ollama.com';
      url = `${endpoint}/api/tags`; 
    } else if (providerId === 'cloudflare') {
      if (!accountId) return NextResponse.json({ error: 'Cloudflare butuh Account ID' }, { status: 400 });
      url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`;
    } else {
      return NextResponse.json({ error: 'Provider tidak didukung' }, { status: 400 });
    }

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gagal mengambil daftar model');
    }

    let models: { id: string, name: string }[] = [];

    if (providerId === 'gemini') {
      models = data.models
        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => ({
          id: m.name.replace('models/', ''), 
          name: m.displayName || m.name
        }));
    } else if (providerId === 'ollama') {
      models = data.models.map((m: any) => ({ id: m.name, name: m.name }));
    } else if (providerId === 'cloudflare') {
      models = data.result.map((m: any) => ({ id: m.name, name: m.name }));
    } else {
      models = data.data.map((m: any) => ({ id: m.id, name: m.id }));
    }

    models.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, models });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}