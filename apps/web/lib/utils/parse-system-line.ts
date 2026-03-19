// apps/web/lib/utils/parse-system-line.ts
// systemLine パーサー（G-1: 共有ユーティリティとして抽出）

import { replaceResidentIds } from '@/lib/data/residents';

export function translateImpressionLabel(label: string): string {
  const dictionary: Record<string, string> = {
    dislike: '苦手',
    maybe_dislike: '嫌いかも',
    awkward: '気まずい',
    none: 'なし',
    curious: '気になる',
    maybe_like: '好きかも',
    like: '好き',
  };

  return dictionary[label] ?? label;
}

export function parseSystemLine(rawLine: string, nameMap: Record<string, string>): string[] {
  if (!rawLine) return [];

  const replaced = replaceResidentIds(rawLine, nameMap);
  if (!replaced.startsWith('SYSTEM: ')) return [replaced];

  const body = replaced.replace(/^SYSTEM:\s*/, '');
  const segments = body.split(' / ').map((segment) => segment.trim()).filter(Boolean);

  const messages: string[] = [];

  segments.forEach((segment) => {
    const favorMatch = segment.match(/^(.*?)→(.*?)\s*好感度:\s*(↑|↓)/);
    if (favorMatch) {
      const [, from, to, direction] = favorMatch;
      const change = direction === '↑' ? '上昇しました。' : '下降しました。';
      messages.push(`${from} から ${to} への好感度が${change}`);
      return;
    }

    const impressionMatch = segment.match(/^(.*?)→(.*?)\s*印象:\s*([^→]+)→(.+)$/);
    if (impressionMatch) {
      const [, from, to, , next] = impressionMatch;
      const translated = translateImpressionLabel(next.trim());
      messages.push(`${from} から ${to} への印象が「${translated}」に変化しました。`);
      return;
    }

    messages.push(segment);
  });

  return messages;
}
