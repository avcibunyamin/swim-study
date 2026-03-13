export const sanitizeInput = (str, maxLen = 100) =>
  String(str || '').trim().slice(0, maxLen).replace(/<[^>]*>/g, '');

export const normalize = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();

export const levenshtein = (a, b) => {
  const m = [];
  const la = a.length;
  const lb = b.length;
  for (let i = 0; i <= la; i++) {
    m[i] = [i];
    for (let j = 1; j <= lb; j++)
      m[i][j] = i === 0
        ? j
        : Math.min(
            m[i - 1][j] + 1,
            m[i][j - 1] + 1,
            m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
  }
  return m[la][lb];
};

export const fuzzyMatch = (query, target) => {
  const q = normalize(query);
  const t = normalize(target);
  if (t.includes(q)) return 0;
  if (q.length < 2) return 100;
  return levenshtein(q, t);
};
