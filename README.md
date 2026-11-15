# NEO STUDIO AI — Complete AI Production Platform

> **Platform Produksi Konten Berbasis Kecerdasan Buatan (AI)**  
> Terinspirasi dari workflow **SUTRADARA AI V5.3** — Didesain untuk sutradara, kreator konten, animator, dan profesional media.

---

## 1. Ikhtisar & Arsitektur Sistem

**NEO STUDIO AI** adalah platform produksi konten mandiri (standalone) yang berjalan 100% dengan prinsip **Local-First Architecture**. Seluruh data naskah, breakdown adegan, karakter konsisten, prompt teknis, dan file biner (gambar, audio, video) disimpan langsung di peramban pengguna menggunakan **IndexedDB & Blob Storage**, tanpa ketergantungan pada database cloud (Firebase, Supabase, PostgreSQL, atau MongoDB).

### Fitur Utama:
- **Dark Cinematic Studio UI**: Palet warna sinematik `#080910`, `#111321`, `#191B2D`, `#8B5CF6`, dan `#22D3EE` yang responsif di perangkat Android, tablet, maupun desktop.
- **Storyboard Studio**: Generator breakdown adegan sinematik lengkap dengan naskah, cue emosi dialog (misal: `[bersemangat]`, `[antusias]`), serta kontrak prompt baku.
- **SUTRADARA AI Prompt Contracts**:
  - `STORYBOARD GRID LOCK - MANDATORY`: Tata letak 3 hingga 5 panel multi-shot terikat dengan konsistensi visual.
  - `[VIDEO FRAME ZERO CONTRACT - ABSOLUTE, NON-NEGOTIABLE]`: Standar kontinuitas temporal untuk model video AI (Google Veo / Flow).
- **Character Consistency System**: Manajemen profil fisik, fitur wajah, gaya rambut, pakaian, dan token konsistensi karakter lintas adegan serta multi-angle model sheet.
- **Image Generator Studio**: Integrasi provider sungguhan (Google Imagen 3 dan Cloudflare FLUX.1 Schnell / SDXL) dengan rasio aspek lengkap (`16:9`, `9:16`, `1:1`, `4:5`, `2.39:1`).
- **Video Generator Studio**: Jalur pipa video generation native Google Veo 2 dengan pelacakan status asinkron, estimasi durasi, dan pencegahan error.
- **Voice Over & Audio Studio**: Sintesis suara narasi/dialog karakter dengan Cloudflare Aura TTS dan fallback Web Speech API.
- **10 Creative Tools**:
  1. *Photo Generator* (Studio editorial 85mm)
  2. *Thumbnail Generator* (High-CTR YouTube/TikTok)
  3. *Infographic Generator* (Modern Swiss vector)
  4. *UGC Generator* (Authentic raw handheld)
  5. *Product Advertisement* (Commercial hero staging)
  6. *Character Sheet* (Multi-angle concept model)
  7. *Product Sheet* (Industrial turnaround)
  8. *Poster Generator* (Theatrical IMAX key visual)
  9. *Social Media Content* (Instagram aesthetic)
  10. *Cinematic Image Generator* (Anamorphic Panavision 2.39:1)
- **Hybrid AI Router**:
  - *Automatic Mode*: Routing cerdas berbasis kapabilitas modalitas, latensi, dan prioritas tugas.
  - *Manual Mode*: Kebebasan menentukan provider dan model spesifik per kategori tugas.
  - *Transparent Fallback*: Pengalihan otomatis saat terjadi rate limit (429) tanpa biaya tersembunyi.
- **Export & Import Mandiri**:
  - Ekspor proyek penuh ke format **ZIP** berisi file `project.json` dan seluruh aset media biner (PNG, MP4, MP3).
  - Impor proyek ZIP dengan sistem re-mapping UUID pencegah tabrakan identitas.
  - Master Backup & Restore seluruh database lokal.

---

## 2. Technology Stack

- **Frontend**: [Next.js](https://nextjs.org/) (App Router), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) dengan Dark Cinematic Design Tokens
- **Icons**: [Lucide React](https://lucide.dev/)
- **Penyimpanan Lokal**: [idb](https://github.com/jakearchibald/idb) (IndexedDB wrapper terstruktur) & Native Browser Blob Engine
- **Arsip & Kompresi**: [JSZip](https://stuk.github.io/jszip/) & [FileSaver](https://github.com/eligrey/FileSaver.js/)
- **Backend API Routes**: Next.js Server-Side Proxy (Zero Client Secret Exposure)

---

## 3. Ekosistem Provider AI Terintegrasi

| Provider | Endpoint / Tipe | Tugas Utama | Model Unggulan |
| :--- | :--- | :--- | :--- |
| **Google Gemini API** | Cloud Native | Story, Script, Breakdown, Imagen 3, Veo 2 | `gemini-2.0-flash`, `gemini-1.5-pro`, `imagen-3.0-generate-002`, `veo-2.0-generate-001` |
| **OpenRouter API** | Unified Gateway | Multi-Model LLM Routing (DeepSeek, Claude, Llama) | `deepseek/deepseek-r1`, `anthropic/claude-3.5-sonnet`, `meta-llama/llama-3.3-70b-instruct`, `google/gemini-2.0-flash-001` |
| **NVIDIA NIM API** | Enterprise Cloud | Deep Reasoning & Story Planning | `meta/llama-3.1-70b-instruct`, `deepseek-ai/deepseek-r1` |
| **Cloudflare Workers AI** | Serverless Edge | Edge Text, FLUX.1 Image, Aura TTS | `@cf/meta/llama-3.1-8b-instruct`, `@cf/black-forest-labs/flux-1-schnell`, `@cf/deepgram/aura-tts` |
| **Groq API** | Ultra-Fast LPU | High-Speed Dialogue, Script, STT | `llama-3.3-70b-versatile`, `whisper-large-v3` |
| **Ollama API** | Local & Remote Host | Offline Inference / Cloud Proxy | `llama3.2`, `qwen2.5`, `mistral` |

> [!TIP]
> **Multi-API Key Pool & Cloudflare Paired Rotation:**  
> - Semua provider mendukung multi-key dengan pemisah koma: `key1, key2, key3`.  
> - Khusus **Cloudflare Workers AI**, API Key dan Account ID dipasangkan secara urut:  
>   `CLOUDFLARE_API_KEY="token_1, token_2, token_3"`  
>   `CLOUDFLARE_ACCOUNT_ID="idakun1, idakun2, idakun3"`  
>   (key 1 menggunakan idakun 1, key 2 menggunakan idakun 2, dst. Jika salah satu terkena limit 429, otomatis failover ke pasangan berikutnya).
> - **OpenRouter API** mendukung multi-key pool (`sk-or-v1-key1, sk-or-v1-key2`) dengan rotasi otomatis saat 429.

> [!IMPORTANT]
> **Panduan Endpoint Ollama (Lokal & Remote Server dengan API Key):**  
> - **Lokal**: Masukkan `http://localhost:11434` dan jalankan dengan `OLLAMA_ORIGINS="*" ollama serve`.  
> - **Remote Host / Cloud Server**: Masukkan URL remote (misal: `https://ollama.domain.com`) dan masukkan **API Key / Bearer Token** jika host diproteksi autentikasi (Reverse Proxy, NGINX, Cloudflare Tunnel/Access).

---

## 4. Panduan Menjalankan Aplikasi

### Mode Produksi (Rekomendasi)
```bash
# Jalankan server produksi
npm run start
# Server aktif di http://localhost:3000
```

### Mode Pengembangan
```bash
npm run dev
```

### Eksekusi Pengujian Otomatis
```bash
node tests/smoke-test.js
```

---

## 5. Lisensi & Hak Cipta
NEO STUDIO AI © 2026. Dikembangkan sebagai sistem mandiri berstandar rekayasa perangkat lunak senior.
