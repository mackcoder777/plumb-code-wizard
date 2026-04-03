export const getCodeDescription = (
  code: string,
  codes: Array<{ code: string; description: string }>
): string => {
  if (!code) return '';
  const found = codes.find(c => c.code === code);
  return found ? `${code} - ${found.description}` : code;
};

export const getCodeDescriptionShort = (
  code: string,
  codes: Array<{ code: string; description: string }>,
  maxDescLength = 20
): string => {
  if (!code) return '';
  const found = codes.find(c => c.code === code);
  if (!found) return code;
  const desc = found.description.length > maxDescLength
    ? found.description.slice(0, maxDescLength) + '…'
    : found.description;
  return `${code} - ${desc}`;
};
