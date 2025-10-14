export function isChitChat(q: string) {
  const s = q.trim().toLowerCase();
  return (
    /^(hi|hey|hello|yo|sup|howdy|thanks|thank you|bye|good\s*(morning|evening|night))\b/.test(s) ||
    s.length < 4
  );
}