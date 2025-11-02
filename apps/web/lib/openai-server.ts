// apps/web/lib/openai-server.ts
import 'server-only'; // これでクライアント側にバンドルされない
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  // import時に落ちると困る場合は関数化して実行時にチェックでもOK
  throw new Error('OPENAI_API_KEY is not set (server).');
}

export function getOpenAI() {
  return new OpenAI({ apiKey });
}
