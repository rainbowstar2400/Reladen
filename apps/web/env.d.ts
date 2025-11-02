// apps/web/env.d.ts
declare module "@/env.mjs" {
  export const env: {
    OPENAI_API_KEY: string;
    [key: string]: string | undefined; // 他の環境変数も許可
  };
}
