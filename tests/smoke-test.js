const http = require('http');

async function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function post(url, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING NEO STUDIO AI SMOKE TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Root page test
    const home = await get('http://127.0.0.1:3000/');
    assert(home.status === 200, 'GET / returns HTTP 200 OK');
    assert(home.data.includes('NEO STUDIO AI') || home.data.includes('__next'), 'HTML includes Next.js application shell');

    // 2. Models Endpoint
    const modelsRes = await get('http://127.0.0.1:3000/api/providers/models');
    assert(modelsRes.status === 200, 'GET /api/providers/models returns HTTP 200');
    const modelsJson = JSON.parse(modelsRes.data);
    assert(modelsJson.success === true, 'Models response success flag is true');
    assert(Array.isArray(modelsJson.models) && modelsJson.models.length >= 10, 'Contains verified models for all 5 providers');

    // Check individual providers represented
    const providersFound = new Set(modelsJson.models.map((m) => m.providerId));
    assert(providersFound.has('gemini'), 'Gemini models registered');
    assert(providersFound.has('openrouter'), 'OpenRouter models registered');
    assert(providersFound.has('nvidia'), 'NVIDIA NIM models registered');
    assert(providersFound.has('cloudflare'), 'Cloudflare models registered');
    assert(providersFound.has('groq'), 'Groq models registered');
    assert(providersFound.has('ollama'), 'Ollama models registered');

    // 3. Provider Test Connection Validation
    const testProv = await post('http://127.0.0.1:3000/api/providers/test', {
      providerId: 'gemini',
      apiKey: '',
    });
    assert(testProv.status === 400, 'POST /api/providers/test validates missing key with 400');

    const testOpenRouter = await post('http://127.0.0.1:3000/api/providers/test', {
      providerId: 'openrouter',
      apiKey: '',
    });
    assert(testOpenRouter.status === 400, 'POST /api/providers/test validates missing openrouter key with 400');

    // 4. Text Generation Validation
    const testTextVal = await post('http://127.0.0.1:3000/api/generate/text', {});
    assert(testTextVal.status === 400, 'POST /api/generate/text validates empty request with 400');

    // 5. Image Generation Validation
    const testImgVal = await post('http://127.0.0.1:3000/api/generate/image', {});
    assert(testImgVal.status === 400, 'POST /api/generate/image validates empty request with 400');

    // 6. Video Generation Validation
    const testVidVal = await post('http://127.0.0.1:3000/api/generate/video', {});
    assert(testVidVal.status === 400, 'POST /api/generate/video validates empty request with 400');

    // 7. Audio Generation Validation
    const testAudVal = await post('http://127.0.0.1:3000/api/generate/audio', {});
    assert(testAudVal.status === 400, 'POST /api/generate/audio validates empty request with 400');

    console.log('--- TEST RESULTS ---');
    console.log(`Passed: ${passed}, Failed: ${failed}`);

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('ALL SMOKE TESTS PASSED SUCCESSFULLY!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Smoke test execution error:', err);
    process.exit(1);
  }
}

// Give server a moment to be reachable
setTimeout(runTests, 1000);
