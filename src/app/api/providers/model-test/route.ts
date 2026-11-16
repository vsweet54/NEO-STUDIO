import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, modelId, apiKey, accountId, baseUrl } = body;

    if (!providerId || !modelId) {
      return NextResponse.json({ success: false, message: 'providerId dan modelId wajib diisi' }, { status: 400 });
    }

    const startTime = Date.now();
    let url = '';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let payload: any = {};

    // ==========================================
    // 1. LOGIKA GOOGLE GEMINI
    // ==========================================
    if (providerId === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      payload = {
        contents: [{ parts: [{ text: 'Halo, ini pesan tes. Balas dengan "OK".' }] }]
      };
    } 
    // ==========================================
    // 2. LOGIKA OLLAMA (Cloud / Local)
    // ==========================================
    else if (providerId === 'ollama') {
      const endpoint = baseUrl || 'https://ollama.com'; 
      url = `${endpoint}/api/chat`;
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      payload = {
        model: modelId,
        messages: [{ role: 'user', content: 'Halo, ini pesan tes. Balas dengan "OK".' }],
        stream: false
      };
    } 
    // ==========================================
    // 3. LOGIKA CLOUDFLARE WORKERS AI
    // ==========================================
    else if (providerId === 'cloudflare') {
      if (!accountId) {
        return NextResponse.json({ success: false, message: 'Cloudflare butuh Account ID' }, { status: 400 });
      }
      url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      
      // Cloudflare punya format payload khusus untuk llama
      payload = { 
        prompt: "Halo, ini pesan tes. Balas dengan 'OK'.",
        max_tokens: 10
      };
    }
    // ==========================================
    // 4. LOGIKA OPENROUTER (Bisa akses Claude, GPT, dll)
    // ==========================================
    else if (providerId === 'openrouter') {
      url = `https://openrouter.ai/api/v1/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      // OpenRouter mewajibkan header referer (opsional, tapi disarankan)
      headers['HTTP-Referer'] = 'https://vercel.app'; 
      headers['X-Title'] = 'NEO-STUDIO';
      
      payload = {
        model: modelId,
        messages: [{ role: 'user', content: 'Halo, ini pesan tes. Balas dengan "OK".' }],
        max_tokens: 10
      };
    }
    // ==========================================
    // 5. LOGIKA GROQ & NVIDIA (OpenAI Compatible)
    // ==========================================
    else if (providerId === 'groq' || providerId === 'nvidia') {
      const defaultUrl = providerId === 'groq' 
        ? 'https://api.groq.com/openai/v1' 
        : 'https://integrate.api.nvidia.com/v1';
        
      url = `${baseUrl || defaultUrl}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      payload = {
        model: modelId,
        messages: [{ role: 'user', content: 'Halo, ini pesan tes. Balas dengan "OK".' }],
        max_tokens: 10
      };
    } 
    // ==========================================
    // FALLBACK (Provider lain yang formatnya OpenAI)
    // ==========================================
    else {
      if (!baseUrl) {
        throw new Error('Base URL wajib diisi untuk provider ini');
      }
      url = `${baseUrl}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      payload = {
        model: modelId,
        messages: [{ role: 'user', content: 'Halo, ini pesan tes. Balas dengan "OK".' }]
      };
    }

    // --- EKSEKUSI FETCH KE PROVIDER ---
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const latency = `${Date.now() - startTime}ms`;
    const data = await response.json();

    // Jika API membalas error (401, 404, 429, dll)
    if (!response.ok) {
      let errorMsg = 'Gagal terhubung';
      if (data.error?.message) errorMsg = data.error.message;
      else if (data.error) errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      else if (data.message) errorMsg = data.message;
      
      throw new Error(`[HTTP ${response.status}] ${errorMsg}`);
    }

    // Jika berhasil
    return NextResponse.json({
      success: true,
      message: `Model ${modelId} berhasil merespons!`,
      latency,
    });

  } catch (error: any) {
    console.error('Model Test Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Terjadi kesalahan saat tes model' },
      { status: 500 }
    );
  }
}