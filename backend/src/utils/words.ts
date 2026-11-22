// Amount-in-words using the South Asian grouping (hazar / lakh / crore).
// Bangla output must be validated by a qualified person before production use (SRS FR-GEN-03).

const EN_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const BN_0_99 = [
  'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়',
  'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোল', 'সতেরো', 'আঠারো', 'উনিশ',
  'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'ঊনত্রিশ',
  'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ',
  'চল্লিশ', 'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ',
  'পঞ্চাশ', 'একান্ন', 'বাহান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট',
  'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর',
  'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি',
  'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই',
  'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই',
];

function en99(n: number): string {
  if (n < 20) return EN_ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${EN_TENS[t]}-${EN_ONES[o]}` : EN_TENS[t];
}
function en999(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${EN_ONES[h]} hundred`);
  if (r) parts.push(en99(r));
  return parts.join(' ');
}

function intWordsGeneric(n: number, w99: (n: number) => string, hundred: string, units: [string, string, string]): string {
  if (n === 0) return w99(0);
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hund = Math.floor(n / 100);
  const rest = n % 100;
  const big = (v: number) => (v < 100 ? w99(v) : intWordsGeneric(v, w99, hundred, units));
  if (crore) parts.push(`${big(crore)} ${units[2]}`);
  if (lakh) parts.push(`${w99(lakh)} ${units[1]}`);
  if (thousand) parts.push(`${w99(thousand)} ${units[0]}`);
  if (hund) parts.push(`${w99(hund)} ${hundred}`);
  if (rest) parts.push(w99(rest));
  return parts.join(' ');
}

function split(amount: number): { taka: number; paisa: number } {
  const cents = Math.round(Math.abs(amount) * 100);
  return { taka: Math.floor(cents / 100), paisa: cents % 100 };
}

export function amountInWordsEn(amount: number): string {
  const { taka, paisa } = split(amount);
  const t = intWordsGeneric(taka, en99, 'hundred', ['thousand', 'lakh', 'crore']);
  const out = `${t} taka`;
  return paisa ? `${out} and ${en99(paisa)} paisa` : out;
}

export function numberInWordsBn(n: number): string {
  return intWordsGeneric(Math.floor(Math.abs(n)), (v) => BN_0_99[v], 'শত', ['হাজার', 'লক্ষ', 'কোটি']);
}

export function amountInWordsBn(amount: number): string {
  const { taka, paisa } = split(amount);
  const t = intWordsGeneric(taka, (n) => BN_0_99[n], 'শত', ['হাজার', 'লক্ষ', 'কোটি']);
  const out = `${t} টাকা`;
  return paisa ? `${out} ${BN_0_99[paisa]} পয়সা` : out;
}

// kept for completeness of the module API
export { en999 as _en999 };
