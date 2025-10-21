import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

type OldCharacter = {
  id?: string;
  name?: string;
  mbti?: string | null;
  traits?: Record<string, unknown> | null;
};

type OldData = {
  characters?: OldCharacter[];
};

type Resident = {
  id: string;
  name: string;
  mbti: string | null;
  traits: Record<string, unknown>;
  updated_at: string;
  deleted: boolean;
};

type ConvertedSeed = {
  residents: Resident[];
  relations: unknown[];
  feelings: unknown[];
  events: unknown[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, 'old_data.json');
const OUTPUT_FILE = path.join(__dirname, 'converted_seed.json');

function ensurePlainObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeResident(character: OldCharacter): Resident {
  const candidateId = typeof character.id === 'string' ? character.id.trim() : '';
  const id = candidateId.length > 0 ? candidateId : randomUUID();
  const name = typeof character.name === 'string' ? character.name : '';
  const rawMbti = typeof character.mbti === 'string' ? character.mbti.trim() : '';
  const mbti = rawMbti.length > 0 ? rawMbti : null;
  const traits = ensurePlainObject(character.traits ?? {});

  return {
    id,
    name,
    mbti,
    traits,
    updated_at: new Date().toISOString(),
    deleted: false,
  };
}

async function main(): Promise<void> {
  const raw = await fs.readFile(INPUT_FILE, 'utf8');
  const data = JSON.parse(raw) as OldData;
  const characters = Array.isArray(data.characters) ? data.characters : [];

  const residents = characters.map((character) => normalizeResident(character ?? {}));

  const converted: ConvertedSeed = {
    residents,
    relations: [],
    feelings: [],
    events: [],
  };

  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(converted, null, 2)}\n`, 'utf8');
  console.log(`変換が完了しました。出力ファイル: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error('変換中にエラーが発生しました。', error);
  process.exit(1);
});
