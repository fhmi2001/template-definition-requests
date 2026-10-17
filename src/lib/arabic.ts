/** العدد مع التمييز الصحيح: 1 مفرد، 2 مثنى، 3–10 جمع، 11 فأكثر مفرد. */
export function arabicCount(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const senderCountText = (n: number) => arabicCount(n, "اسم مرسل واحد", "اسمي مرسل", "أسماء مرسلين", "اسم مرسل");
