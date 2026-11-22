import type { FieldDef } from '@/components/RecordsPage';

const phoneOk = (v: string) => {
  const s = v.replace(/[\s\-().]/g, '');
  return /^(?:\+?88)?01[3-9]\d{8}$/.test(s) || /^\+?\d{7,15}$/.test(s) ? undefined : 'Enter a valid phone number (e.g. 01712345678)';
};

/** The four main religions plus "others" (stored as the Bangla name, printed as-is in the deed). */
export const RELIGIONS = ['ইসলাম', 'হিন্দু', 'বৌদ্ধ', 'খ্রিষ্টান', 'অন্যান্য'];

/** Everything a Bangladeshi deed prints about a party (SRS BR-01 + Form 40 style). Required fields mirror the API. */
export const CUSTOMER_DEFAULTS: Record<string, string> = { nationality: 'বাংলাদেশী' };
export const CUSTOMER_FIELDS: FieldDef[] = [
  { name: 'name', label: 'নাম (Full name)', required: true, validate: (v) => (v.length < 2 ? 'Full name must be at least 2 characters' : undefined) },
  { name: 'fatherName', label: 'পিতার নাম (Father name)' },
  { name: 'motherName', label: 'মাতার নাম (Mother name)' },
  { name: 'husbandName', label: 'স্বামীর নাম (Husband name)', hint: 'Leave blank if not applicable – prints "প্রযোজ্য নহে".' },
  { name: 'birthDate', label: 'জন্ম তারিখ (Date of birth)', type: 'date', required: true, validate: (v) => (new Date(v).getTime() > Date.now() ? 'Date of birth cannot be in the future' : new Date(v).getFullYear() < 1900 ? 'Enter a valid date of birth' : undefined) },
  { name: 'religion', label: 'ধর্ম (Religion)', type: 'select', options: RELIGIONS, required: true },
  { name: 'profession', label: 'পেশা (Profession)' },
  { name: 'nationality', label: 'জাতীয়তা (Nationality)', required: true },
  { name: 'nid', label: 'জাতীয় পরিচয়পত্র নম্বর (NID)', required: true, hint: '10, 13 or 17 digits.', validate: (v) => (/^(\d{10}|\d{13}|\d{17})$/.test(v) ? undefined : 'NID must be 10, 13 or 17 digits') },
  { name: 'phone', label: 'মোবাইল (Phone)', required: true, validate: phoneOk },
  { name: 'email', label: 'Email', type: 'email', validate: (v) => (/^\S+@\S+\.\S+$/.test(v) ? undefined : 'Enter a valid email address') },
  { name: 'permanentAddress', label: 'স্থায়ী ঠিকানা (Permanent address)', type: 'textarea', span: 3, required: true, hint: 'গ্রাম/রোড, ডাকঘর, থানা/উপজেলা, জেলা' },
  { name: 'address', label: 'বর্তমান ঠিকানা (Present address)', type: 'textarea', span: 3 },
  { name: 'notes', label: 'Notes', type: 'textarea', span: 3 },
];

/** Everything the তফসিল and চৌহদ্দি need. */
export const landFields = (units: string[]): FieldDef[] => [
  { name: 'district', label: 'জেলা (District)', type: 'district', required: true },
  { name: 'upazila', label: 'থানা/উপজেলা (Upazila / Thana)', type: 'upazila', required: true },
  { name: 'mouza', label: 'মৌজা (Mouza)', required: true },
  { name: 'jlNumber', label: 'জে.এল নং (JL number)' },
  { name: 'union', label: 'ইউনিয়ন/পৌরসভা (Union)' },
  { name: 'landOffice', label: 'ভূমি অফিস (Land office)', required: true },
  { name: 'khatianType', label: 'খতিয়ানের ধরন (e.g. আর.এস)' },
  { name: 'khatianNumber', label: 'খতিয়ান নং (Khatian number)', required: true },
  { name: 'holdingNo', label: 'হোল্ডিং নং (Holding no.)', required: true },
  { name: 'dagNumber', label: 'দাগ নং (Dag number)', required: true, hint: 'Keep the original notation, including leading zeros.' },
  { name: 'area', label: 'দাগে জমির পরিমাণ (Area)', type: 'number', required: true, validate: (v) => (Number(v) > 0 ? undefined : 'Area must be greater than zero') },
  { name: 'areaUnit', label: 'একক (Area unit)', type: 'select', required: true, options: units },
  { name: 'classification', label: 'শ্রেণি (Land class, e.g. ধানি / ভিটা)' },
  { name: 'ownershipDetails', label: 'Ownership details (office note)', type: 'textarea', span: 3, hint: 'A stored record does not prove ownership.' },
  { name: 'boundaryNorth', label: 'চৌহদ্দি – উত্তর (North)' },
  { name: 'boundarySouth', label: 'চৌহদ্দি – দক্ষিণ (South)' },
  { name: 'boundaryEast', label: 'চৌহদ্দি – পূর্ব (East)' },
  { name: 'boundaryWest', label: 'চৌহদ্দি – পশ্চিম (West)' },
];

export const CUSTOMER_MISSING: [string, string][] = [
  ['fatherName', 'পিতার নাম'], ['motherName', 'মাতার নাম'], ['birthDate', 'জন্ম তারিখ'], ['religion', 'ধর্ম'],
  ['profession', 'পেশা'], ['nid', 'NID'], ['permanentAddress', 'স্থায়ী ঠিকানা'], ['address', 'বর্তমান ঠিকানা'],
];
export const WITNESS_MISSING: [string, string][] = [['fatherName', 'পিতার নাম'], ['address', 'ঠিকানা'], ['nid', 'NID']];

export function missingCustomer(c: any, role: string): string[] {
  const list = role === 'WITNESS' || role === 'REPRESENTATIVE' ? WITNESS_MISSING : CUSTOMER_MISSING;
  return list.filter(([k]) => !c?.[k] || String(c[k]).trim() === '').map(([, l]) => l);
}
export function missingLand(l: any): string[] {
  const out: string[] = [];
  for (const [k, label] of [['union', 'ইউনিয়ন'], ['landOffice', 'ভূমি অফিস'], ['jlNumber', 'জে.এল নং'], ['khatianNumber', 'খতিয়ান'], ['classification', 'শ্রেণি']] as const) {
    if (!l?.[k] || String(l[k]).trim() === '') out.push(label);
  }
  if (!['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'].every((k) => l?.[k] && String(l[k]).trim())) out.push('চৌহদ্দি');
  return out;
}
