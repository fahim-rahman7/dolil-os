// Bangladesh districts (জেলা) and their upazilas / thanas (উপজেলা) – 64 districts, 495 upazilas.
// Bangla names are what gets stored on a land record and printed in the deed (তফসিল).
// Source: BBS geocode based open datasets (bangladesh-location-data, @bangladeshi/bangladesh-address), cross-checked
// for per-district counts, with Bangla spelling corrections and the 2021 upazilas (দাসার, ঈদগাঁও, মধ্যনগর) added.
// Metropolitan police-station thanas and anything missing here can be entered with the "অন্যান্য" option in the form.

export interface GeoUpazila { bn: string; en: string }
export interface GeoDistrict { bn: string; en: string; upazilas: GeoUpazila[] }

export const BD_GEO: GeoDistrict[] = [
 {
  "bn": "বাগেরহাট",
  "en": "Bagerhat",
  "upazilas": [
   {
    "bn": "কচুয়া",
    "en": "Kachua"
   },
   {
    "bn": "চিতলমারী",
    "en": "Chitalmari"
   },
   {
    "bn": "ফকিরহাট",
    "en": "Fakirhat"
   },
   {
    "bn": "বাগেরহাট সদর",
    "en": "Bagerhat Sadar"
   },
   {
    "bn": "মোংলা",
    "en": "Mongla"
   },
   {
    "bn": "মোড়েলগঞ্জ",
    "en": "Morrelganj"
   },
   {
    "bn": "মোল্লাহাট",
    "en": "Mollahat"
   },
   {
    "bn": "রামপাল",
    "en": "Rampal"
   },
   {
    "bn": "শরণখোলা",
    "en": "Sarankhola"
   }
  ]
 },
 {
  "bn": "বান্দরবান",
  "en": "Bandarban",
  "upazilas": [
   {
    "bn": "আলীকদম",
    "en": "Alikadam"
   },
   {
    "bn": "থানচি",
    "en": "Thanchi"
   },
   {
    "bn": "নাইক্ষ্যংছড়ি",
    "en": "Naikhongchhari"
   },
   {
    "bn": "বান্দরবান সদর",
    "en": "Bandarban Sadar"
   },
   {
    "bn": "রুমা",
    "en": "Ruma"
   },
   {
    "bn": "রোয়াংছড়ি",
    "en": "Rowangchhari"
   },
   {
    "bn": "লামা",
    "en": "Lama"
   }
  ]
 },
 {
  "bn": "বরগুনা",
  "en": "Barguna",
  "upazilas": [
   {
    "bn": "আমতলী",
    "en": "Amtali"
   },
   {
    "bn": "তালতলী",
    "en": "Taltali"
   },
   {
    "bn": "পাথরঘাটা",
    "en": "Pathorghata"
   },
   {
    "bn": "বরগুনা সদর",
    "en": "Barguna Sadar"
   },
   {
    "bn": "বামনা",
    "en": "Bamna"
   },
   {
    "bn": "বেতাগী",
    "en": "Betagi"
   }
  ]
 },
 {
  "bn": "বরিশাল",
  "en": "Barishal",
  "upazilas": [
   {
    "bn": "আগৈলঝাড়া",
    "en": "Agailjhara"
   },
   {
    "bn": "উজিরপুর",
    "en": "Wazirpur"
   },
   {
    "bn": "গৌরনদী",
    "en": "Gournadi"
   },
   {
    "bn": "বরিশাল সদর",
    "en": "Barisal Sadar"
   },
   {
    "bn": "বাকেরগঞ্জ",
    "en": "Bakerganj"
   },
   {
    "bn": "বানারীপাড়া",
    "en": "Banaripara"
   },
   {
    "bn": "বাবুগঞ্জ",
    "en": "Babuganj"
   },
   {
    "bn": "মুলাদী",
    "en": "Muladi"
   },
   {
    "bn": "মেহেন্দিগঞ্জ",
    "en": "Mehendiganj"
   },
   {
    "bn": "হিজলা",
    "en": "Hizla"
   }
  ]
 },
 {
  "bn": "ভোলা",
  "en": "Bhola",
  "upazilas": [
   {
    "bn": "চরফ্যাশন",
    "en": "Charfesson"
   },
   {
    "bn": "তজুমদ্দিন",
    "en": "Tazumuddin"
   },
   {
    "bn": "দৌলতখান",
    "en": "Doulatkhan"
   },
   {
    "bn": "বোরহানউদ্দিন",
    "en": "Borhan Sddin"
   },
   {
    "bn": "ভোলা সদর",
    "en": "Bhola Sadar"
   },
   {
    "bn": "মনপুরা",
    "en": "Monpura"
   },
   {
    "bn": "লালমোহন",
    "en": "Lalmohan"
   }
  ]
 },
 {
  "bn": "বগুড়া",
  "en": "Bogura",
  "upazilas": [
   {
    "bn": "আদমদীঘি",
    "en": "Adamdighi"
   },
   {
    "bn": "কাহালু",
    "en": "Kahaloo"
   },
   {
    "bn": "গাবতলী",
    "en": "Gabtali"
   },
   {
    "bn": "দুপচাচিঁয়া",
    "en": "Dupchanchia"
   },
   {
    "bn": "ধুনট",
    "en": "Dhunot"
   },
   {
    "bn": "নন্দিগ্রাম",
    "en": "Nondigram"
   },
   {
    "bn": "বগুড়া সদর",
    "en": "Bogra Sadar"
   },
   {
    "bn": "শাজাহানপুর",
    "en": "Shajahanpur"
   },
   {
    "bn": "শিবগঞ্জ",
    "en": "Shibganj"
   },
   {
    "bn": "শেরপুর",
    "en": "Sherpur"
   },
   {
    "bn": "সারিয়াকান্দি",
    "en": "Shariakandi"
   },
   {
    "bn": "সোনাতলা",
    "en": "Sonatala"
   }
  ]
 },
 {
  "bn": "ব্রাহ্মণবাড়িয়া",
  "en": "Brahmanbaria",
  "upazilas": [
   {
    "bn": "আখাউড়া",
    "en": "Akhaura"
   },
   {
    "bn": "আশুগঞ্জ",
    "en": "Ashuganj"
   },
   {
    "bn": "কসবা",
    "en": "Kasba"
   },
   {
    "bn": "নবীনগর",
    "en": "Nabinagar"
   },
   {
    "bn": "নাসিরনগর",
    "en": "Nasirnagar"
   },
   {
    "bn": "বাঞ্ছারামপুর",
    "en": "Bancharampur"
   },
   {
    "bn": "বিজয়নগর",
    "en": "Bijoynagar"
   },
   {
    "bn": "ব্রাহ্মণবাড়িয়া সদর",
    "en": "Brahmanbaria Sadar"
   },
   {
    "bn": "সরাইল",
    "en": "Sarail"
   }
  ]
 },
 {
  "bn": "চাঁদপুর",
  "en": "Chandpur",
  "upazilas": [
   {
    "bn": "কচুয়া",
    "en": "Kachua"
   },
   {
    "bn": "চাঁদপুর সদর",
    "en": "Chandpur Sadar"
   },
   {
    "bn": "ফরিদগঞ্জ",
    "en": "Faridgonj"
   },
   {
    "bn": "মতলব উত্তর",
    "en": "Matlab North"
   },
   {
    "bn": "মতলব দক্ষিণ",
    "en": "Matlab South"
   },
   {
    "bn": "শাহরাস্তি",
    "en": "Shahrasti"
   },
   {
    "bn": "হাইমচর",
    "en": "Haimchar"
   },
   {
    "bn": "হাজীগঞ্জ",
    "en": "Hajiganj"
   }
  ]
 },
 {
  "bn": "চাঁপাইনবাবগঞ্জ",
  "en": "Chapainawabganj",
  "upazilas": [
   {
    "bn": "গোমস্তাপুর",
    "en": "Gomostapur"
   },
   {
    "bn": "চাঁপাইনবাবগঞ্জ সদর",
    "en": "Chapainawabganj Sadar"
   },
   {
    "bn": "নাচোল",
    "en": "Nachol"
   },
   {
    "bn": "ভোলাহাট",
    "en": "Bholahat"
   },
   {
    "bn": "শিবগঞ্জ",
    "en": "Shibganj"
   }
  ]
 },
 {
  "bn": "চট্টগ্রাম",
  "en": "Chattogram",
  "upazilas": [
   {
    "bn": "আনোয়ারা",
    "en": "Anwara"
   },
   {
    "bn": "কর্ণফুলী",
    "en": "Karnafuli"
   },
   {
    "bn": "চন্দনাইশ",
    "en": "Chandanaish"
   },
   {
    "bn": "পটিয়া",
    "en": "Patiya"
   },
   {
    "bn": "ফটিকছড়ি",
    "en": "Fatikchhari"
   },
   {
    "bn": "বাঁশখালী",
    "en": "Banshkhali"
   },
   {
    "bn": "বোয়ালখালী",
    "en": "Boalkhali"
   },
   {
    "bn": "মীরসরাই",
    "en": "Mirsharai"
   },
   {
    "bn": "রাউজান",
    "en": "Raozan"
   },
   {
    "bn": "রাঙ্গুনিয়া",
    "en": "Rangunia"
   },
   {
    "bn": "লোহাগাড়া",
    "en": "Lohagara"
   },
   {
    "bn": "সন্দ্বীপ",
    "en": "Sandwip"
   },
   {
    "bn": "সাতকানিয়া",
    "en": "Satkania"
   },
   {
    "bn": "সীতাকুণ্ড",
    "en": "Sitakunda"
   },
   {
    "bn": "হাটহাজারী",
    "en": "Hathazari"
   }
  ]
 },
 {
  "bn": "চুয়াডাঙ্গা",
  "en": "Chuadanga",
  "upazilas": [
   {
    "bn": "আলমডাঙ্গা",
    "en": "Alamdanga"
   },
   {
    "bn": "চুয়াডাঙ্গা সদর",
    "en": "Chuadanga Sadar"
   },
   {
    "bn": "জীবননগর",
    "en": "Jibannagar"
   },
   {
    "bn": "দামুড়হুদা",
    "en": "Damurhuda"
   }
  ]
 },
 {
  "bn": "কক্সবাজার",
  "en": "Cox's Bazar",
  "upazilas": [
   {
    "bn": "ঈদগাঁও",
    "en": "Eidgaon"
   },
   {
    "bn": "উখিয়া",
    "en": "Ukhiya"
   },
   {
    "bn": "কক্সবাজার সদর",
    "en": "Coxsbazar Sadar"
   },
   {
    "bn": "কুতুবদিয়া",
    "en": "Kutubdia"
   },
   {
    "bn": "চকরিয়া",
    "en": "Chakaria"
   },
   {
    "bn": "টেকনাফ",
    "en": "Teknaf"
   },
   {
    "bn": "পেকুয়া",
    "en": "Pekua"
   },
   {
    "bn": "মহেশখালী",
    "en": "Moheshkhali"
   },
   {
    "bn": "রামু",
    "en": "Ramu"
   }
  ]
 },
 {
  "bn": "কুমিল্লা",
  "en": "Cumilla",
  "upazilas": [
   {
    "bn": "কুমিল্লা সদর",
    "en": "Comilla Sadar"
   },
   {
    "bn": "চান্দিনা",
    "en": "Chandina"
   },
   {
    "bn": "চৌদ্দগ্রাম",
    "en": "Chauddagram"
   },
   {
    "bn": "তিতাস",
    "en": "Titas"
   },
   {
    "bn": "দাউদকান্দি",
    "en": "Daudkandi"
   },
   {
    "bn": "দেবিদ্বার",
    "en": "Debidwar"
   },
   {
    "bn": "নাঙ্গলকোট",
    "en": "Nangalkot"
   },
   {
    "bn": "বরুড়া",
    "en": "Barura"
   },
   {
    "bn": "বুড়িচং",
    "en": "Burichang"
   },
   {
    "bn": "ব্রাহ্মণপাড়া",
    "en": "Brahmanpara"
   },
   {
    "bn": "মনোহরগঞ্জ",
    "en": "Monohargonj"
   },
   {
    "bn": "মুরাদনগর",
    "en": "Muradnagar"
   },
   {
    "bn": "মেঘনা",
    "en": "Meghna"
   },
   {
    "bn": "লাকসাম",
    "en": "Laksam"
   },
   {
    "bn": "লালমাই",
    "en": "Lalmai"
   },
   {
    "bn": "সদর দক্ষিণ",
    "en": "Sadarsouth"
   },
   {
    "bn": "হোমনা",
    "en": "Homna"
   }
  ]
 },
 {
  "bn": "ঢাকা",
  "en": "Dhaka",
  "upazilas": [
   {
    "bn": "কেরানীগঞ্জ",
    "en": "Keraniganj"
   },
   {
    "bn": "দোহার",
    "en": "Dohar"
   },
   {
    "bn": "ধামরাই",
    "en": "Dhamrai"
   },
   {
    "bn": "নবাবগঞ্জ",
    "en": "Nawabganj"
   },
   {
    "bn": "সাভার",
    "en": "Savar"
   }
  ]
 },
 {
  "bn": "দিনাজপুর",
  "en": "Dinajpur",
  "upazilas": [
   {
    "bn": "কাহারোল",
    "en": "Kaharol"
   },
   {
    "bn": "খানসামা",
    "en": "Khansama"
   },
   {
    "bn": "ঘোড়াঘাট",
    "en": "Ghoraghat"
   },
   {
    "bn": "চিরিরবন্দর",
    "en": "Chirirbandar"
   },
   {
    "bn": "দিনাজপুর সদর",
    "en": "Dinajpur Sadar"
   },
   {
    "bn": "নবাবগঞ্জ",
    "en": "Nawabganj"
   },
   {
    "bn": "পার্বতীপুর",
    "en": "Parbatipur"
   },
   {
    "bn": "ফুলবাড়ী",
    "en": "Fulbari"
   },
   {
    "bn": "বিরল",
    "en": "Birol"
   },
   {
    "bn": "বিরামপুর",
    "en": "Birampur"
   },
   {
    "bn": "বীরগঞ্জ",
    "en": "Birganj"
   },
   {
    "bn": "বোচাগঞ্জ",
    "en": "Bochaganj"
   },
   {
    "bn": "হাকিমপুর",
    "en": "Hakimpur"
   }
  ]
 },
 {
  "bn": "ফরিদপুর",
  "en": "Faridpur",
  "upazilas": [
   {
    "bn": "আলফাডাঙ্গা",
    "en": "Alfadanga"
   },
   {
    "bn": "চরভদ্রাসন",
    "en": "Charbhadrasan"
   },
   {
    "bn": "নগরকান্দা",
    "en": "Nagarkanda"
   },
   {
    "bn": "ফরিদপুর সদর",
    "en": "Faridpur Sadar"
   },
   {
    "bn": "বোয়ালমারী",
    "en": "Boalmari"
   },
   {
    "bn": "ভাঙ্গা",
    "en": "Bhanga"
   },
   {
    "bn": "মধুখালী",
    "en": "Madhukhali"
   },
   {
    "bn": "সদরপুর",
    "en": "Sadarpur"
   },
   {
    "bn": "সালথা",
    "en": "Saltha"
   }
  ]
 },
 {
  "bn": "ফেনী",
  "en": "Feni",
  "upazilas": [
   {
    "bn": "ছাগলনাইয়া",
    "en": "Chhagalnaiya"
   },
   {
    "bn": "দাগনভূঞা",
    "en": "Daganbhuiyan"
   },
   {
    "bn": "পরশুরাম",
    "en": "Parshuram"
   },
   {
    "bn": "ফুলগাজী",
    "en": "Fulgazi"
   },
   {
    "bn": "ফেনী সদর",
    "en": "Feni Sadar"
   },
   {
    "bn": "সোনাগাজী",
    "en": "Sonagazi"
   }
  ]
 },
 {
  "bn": "গাইবান্ধা",
  "en": "Gaibandha",
  "upazilas": [
   {
    "bn": "গাইবান্ধা সদর",
    "en": "Gaibandha Sadar"
   },
   {
    "bn": "গোবিন্দগঞ্জ",
    "en": "Gobindaganj"
   },
   {
    "bn": "পলাশবাড়ী",
    "en": "Palashbari"
   },
   {
    "bn": "ফুলছড়ি",
    "en": "Phulchari"
   },
   {
    "bn": "সাঘাটা",
    "en": "Saghata"
   },
   {
    "bn": "সাদুল্লাপুর",
    "en": "Sadullapur"
   },
   {
    "bn": "সুন্দরগঞ্জ",
    "en": "Sundarganj"
   }
  ]
 },
 {
  "bn": "গাজীপুর",
  "en": "Gazipur",
  "upazilas": [
   {
    "bn": "কাপাসিয়া",
    "en": "Kapasia"
   },
   {
    "bn": "কালিয়াকৈর",
    "en": "Kaliakair"
   },
   {
    "bn": "কালীগঞ্জ",
    "en": "Kaliganj"
   },
   {
    "bn": "গাজীপুর সদর",
    "en": "Gazipur Sadar"
   },
   {
    "bn": "শ্রীপুর",
    "en": "Sreepur"
   }
  ]
 },
 {
  "bn": "গোপালগঞ্জ",
  "en": "Gopalganj",
  "upazilas": [
   {
    "bn": "কাশিয়ানী",
    "en": "Kashiani"
   },
   {
    "bn": "কোটালীপাড়া",
    "en": "Kotalipara"
   },
   {
    "bn": "গোপালগঞ্জ সদর",
    "en": "Gopalganj Sadar"
   },
   {
    "bn": "টুঙ্গীপাড়া",
    "en": "Tungipara"
   },
   {
    "bn": "মুকসুদপুর",
    "en": "Muksudpur"
   }
  ]
 },
 {
  "bn": "হবিগঞ্জ",
  "en": "Habiganj",
  "upazilas": [
   {
    "bn": "আজমিরীগঞ্জ",
    "en": "Ajmiriganj"
   },
   {
    "bn": "চুনারুঘাট",
    "en": "Chunarughat"
   },
   {
    "bn": "নবীগঞ্জ",
    "en": "Nabiganj"
   },
   {
    "bn": "বানিয়াচং",
    "en": "Baniachong"
   },
   {
    "bn": "বাহুবল",
    "en": "Bahubal"
   },
   {
    "bn": "মাধবপুর",
    "en": "Madhabpur"
   },
   {
    "bn": "লাখাই",
    "en": "Lakhai"
   },
   {
    "bn": "শায়েস্তাগঞ্জ",
    "en": "Shayestagonj"
   },
   {
    "bn": "হবিগঞ্জ সদর",
    "en": "Habiganj Sadar"
   }
  ]
 },
 {
  "bn": "জামালপুর",
  "en": "Jamalpur",
  "upazilas": [
   {
    "bn": "ইসলামপুর",
    "en": "Islampur"
   },
   {
    "bn": "জামালপুর সদর",
    "en": "Jamalpur Sadar"
   },
   {
    "bn": "দেওয়ানগঞ্জ",
    "en": "Dewangonj"
   },
   {
    "bn": "বকশীগঞ্জ",
    "en": "Bokshiganj"
   },
   {
    "bn": "মাদারগঞ্জ",
    "en": "Madarganj"
   },
   {
    "bn": "মেলান্দহ",
    "en": "Melandah"
   },
   {
    "bn": "সরিষাবাড়ী",
    "en": "Sarishabari"
   }
  ]
 },
 {
  "bn": "যশোর",
  "en": "Jashore",
  "upazilas": [
   {
    "bn": "অভয়নগর",
    "en": "Abhaynagar"
   },
   {
    "bn": "কেশবপুর",
    "en": "Keshabpur"
   },
   {
    "bn": "চৌগাছা",
    "en": "Chougachha"
   },
   {
    "bn": "ঝিকরগাছা",
    "en": "Jhikargacha"
   },
   {
    "bn": "বাঘারপাড়া",
    "en": "Bagherpara"
   },
   {
    "bn": "মণিরামপুর",
    "en": "Manirampur"
   },
   {
    "bn": "যশোর সদর",
    "en": "Jessore Sadar"
   },
   {
    "bn": "শার্শা",
    "en": "Sharsha"
   }
  ]
 },
 {
  "bn": "ঝালকাঠি",
  "en": "Jhalokati",
  "upazilas": [
   {
    "bn": "কাঠালিয়া",
    "en": "Kathalia"
   },
   {
    "bn": "ঝালকাঠি সদর",
    "en": "Jhalakathi Sadar"
   },
   {
    "bn": "নলছিটি",
    "en": "Nalchity"
   },
   {
    "bn": "রাজাপুর",
    "en": "Rajapur"
   }
  ]
 },
 {
  "bn": "ঝিনাইদহ",
  "en": "Jhenaidah",
  "upazilas": [
   {
    "bn": "কালীগঞ্জ",
    "en": "Kaliganj"
   },
   {
    "bn": "কোটচাঁদপুর",
    "en": "Kotchandpur"
   },
   {
    "bn": "ঝিনাইদহ সদর",
    "en": "Jhenaidah Sadar"
   },
   {
    "bn": "মহেশপুর",
    "en": "Moheshpur"
   },
   {
    "bn": "শৈলকুপা",
    "en": "Shailkupa"
   },
   {
    "bn": "হরিণাকুণ্ডু",
    "en": "Harinakundu"
   }
  ]
 },
 {
  "bn": "জয়পুরহাট",
  "en": "Joypurhat",
  "upazilas": [
   {
    "bn": "আক্কেলপুর",
    "en": "Akkelpur"
   },
   {
    "bn": "কালাই",
    "en": "Kalai"
   },
   {
    "bn": "ক্ষেতলাল",
    "en": "Khetlal"
   },
   {
    "bn": "জয়পুরহাট সদর",
    "en": "Joypurhat Sadar"
   },
   {
    "bn": "পাঁচবিবি",
    "en": "Panchbibi"
   }
  ]
 },
 {
  "bn": "খাগড়াছড়ি",
  "en": "Khagrachhari",
  "upazilas": [
   {
    "bn": "খাগড়াছড়ি সদর",
    "en": "Khagrachhari Sadar"
   },
   {
    "bn": "গুইমারা",
    "en": "Guimara"
   },
   {
    "bn": "দিঘীনালা",
    "en": "Dighinala"
   },
   {
    "bn": "পানছড়ি",
    "en": "Panchari"
   },
   {
    "bn": "মহালছড়ি",
    "en": "Mohalchari"
   },
   {
    "bn": "মাটিরাঙ্গা",
    "en": "Matiranga"
   },
   {
    "bn": "মানিকছড়ি",
    "en": "Manikchari"
   },
   {
    "bn": "রামগড়",
    "en": "Ramgarh"
   },
   {
    "bn": "লক্ষ্মীছড়ি",
    "en": "Laxmichhari"
   }
  ]
 },
 {
  "bn": "খুলনা",
  "en": "Khulna",
  "upazilas": [
   {
    "bn": "কয়রা",
    "en": "Koyra"
   },
   {
    "bn": "ডুমুরিয়া",
    "en": "Dumuria"
   },
   {
    "bn": "তেরখাদা",
    "en": "Terokhada"
   },
   {
    "bn": "দাকোপ",
    "en": "Dakop"
   },
   {
    "bn": "দিঘলিয়া",
    "en": "Digholia"
   },
   {
    "bn": "পাইকগাছা",
    "en": "Paikgasa"
   },
   {
    "bn": "ফুলতলা",
    "en": "Fultola"
   },
   {
    "bn": "বটিয়াঘাটা",
    "en": "Botiaghata"
   },
   {
    "bn": "রূপসা",
    "en": "Rupsha"
   }
  ]
 },
 {
  "bn": "কিশোরগঞ্জ",
  "en": "Kishoreganj",
  "upazilas": [
   {
    "bn": "অষ্টগ্রাম",
    "en": "Austagram"
   },
   {
    "bn": "ইটনা",
    "en": "Itna"
   },
   {
    "bn": "কটিয়াদী",
    "en": "Katiadi"
   },
   {
    "bn": "করিমগঞ্জ",
    "en": "Karimgonj"
   },
   {
    "bn": "কিশোরগঞ্জ সদর",
    "en": "Kishoreganj Sadar"
   },
   {
    "bn": "কুলিয়ারচর",
    "en": "Kuliarchar"
   },
   {
    "bn": "তাড়াইল",
    "en": "Tarail"
   },
   {
    "bn": "নিকলী",
    "en": "Nikli"
   },
   {
    "bn": "পাকুন্দিয়া",
    "en": "Pakundia"
   },
   {
    "bn": "বাজিতপুর",
    "en": "Bajitpur"
   },
   {
    "bn": "ভৈরব",
    "en": "Bhairab"
   },
   {
    "bn": "মিঠামইন",
    "en": "Mithamoin"
   },
   {
    "bn": "হোসেনপুর",
    "en": "Hossainpur"
   }
  ]
 },
 {
  "bn": "কুড়িগ্রাম",
  "en": "Kurigram",
  "upazilas": [
   {
    "bn": "উলিপুর",
    "en": "Ulipur"
   },
   {
    "bn": "কুড়িগ্রাম সদর",
    "en": "Kurigram Sadar"
   },
   {
    "bn": "চর রাজিবপুর",
    "en": "Charrajibpur"
   },
   {
    "bn": "চিলমারী",
    "en": "Chilmari"
   },
   {
    "bn": "নাগেশ্বরী",
    "en": "Nageshwari"
   },
   {
    "bn": "ফুলবাড়ী",
    "en": "Phulbari"
   },
   {
    "bn": "ভুরুঙ্গামারী",
    "en": "Bhurungamari"
   },
   {
    "bn": "রাজারহাট",
    "en": "Rajarhat"
   },
   {
    "bn": "রৌমারী",
    "en": "Rowmari"
   }
  ]
 },
 {
  "bn": "কুষ্টিয়া",
  "en": "Kushtia",
  "upazilas": [
   {
    "bn": "কুমারখালী",
    "en": "Kumarkhali"
   },
   {
    "bn": "কুষ্টিয়া সদর",
    "en": "Kushtia Sadar"
   },
   {
    "bn": "খোকসা",
    "en": "Khoksa"
   },
   {
    "bn": "দৌলতপুর",
    "en": "Daulatpur"
   },
   {
    "bn": "ভেড়ামারা",
    "en": "Bheramara"
   },
   {
    "bn": "মিরপুর",
    "en": "Mirpur"
   }
  ]
 },
 {
  "bn": "লক্ষ্মীপুর",
  "en": "Lakshmipur",
  "upazilas": [
   {
    "bn": "কমলনগর",
    "en": "Kamalnagar"
   },
   {
    "bn": "রামগঞ্জ",
    "en": "Ramganj"
   },
   {
    "bn": "রামগতি",
    "en": "Ramgati"
   },
   {
    "bn": "রায়পুর",
    "en": "Raipur"
   },
   {
    "bn": "লক্ষ্মীপুর সদর",
    "en": "Lakshmipur Sadar"
   }
  ]
 },
 {
  "bn": "লালমনিরহাট",
  "en": "Lalmonirhat",
  "upazilas": [
   {
    "bn": "আদিতমারী",
    "en": "Aditmari"
   },
   {
    "bn": "কালীগঞ্জ",
    "en": "Kaliganj"
   },
   {
    "bn": "পাটগ্রাম",
    "en": "Patgram"
   },
   {
    "bn": "লালমনিরহাট সদর",
    "en": "Lalmonirhat Sadar"
   },
   {
    "bn": "হাতীবান্ধা",
    "en": "Hatibandha"
   }
  ]
 },
 {
  "bn": "মাদারীপুর",
  "en": "Madaripur",
  "upazilas": [
   {
    "bn": "কালকিনি",
    "en": "Kalkini"
   },
   {
    "bn": "দাসার",
    "en": "Dasar"
   },
   {
    "bn": "মাদারীপুর সদর",
    "en": "Madaripur Sadar"
   },
   {
    "bn": "রাজৈর",
    "en": "Rajoir"
   },
   {
    "bn": "শিবচর",
    "en": "Shibchar"
   }
  ]
 },
 {
  "bn": "মাগুরা",
  "en": "Magura",
  "upazilas": [
   {
    "bn": "মহম্মদপুর",
    "en": "Mohammadpur"
   },
   {
    "bn": "মাগুরা সদর",
    "en": "Magura Sadar"
   },
   {
    "bn": "শালিখা",
    "en": "Shalikha"
   },
   {
    "bn": "শ্রীপুর",
    "en": "Sreepur"
   }
  ]
 },
 {
  "bn": "মানিকগঞ্জ",
  "en": "Manikganj",
  "upazilas": [
   {
    "bn": "ঘিওর",
    "en": "Gior"
   },
   {
    "bn": "দৌলতপুর",
    "en": "Doulatpur"
   },
   {
    "bn": "মানিকগঞ্জ সদর",
    "en": "Manikganj Sadar"
   },
   {
    "bn": "শিবালয়",
    "en": "Shibaloy"
   },
   {
    "bn": "সাটুরিয়া",
    "en": "Saturia"
   },
   {
    "bn": "সিংগাইর",
    "en": "Singiar"
   },
   {
    "bn": "হরিরামপুর",
    "en": "Harirampur"
   }
  ]
 },
 {
  "bn": "মেহেরপুর",
  "en": "Meherpur",
  "upazilas": [
   {
    "bn": "গাংনী",
    "en": "Gangni"
   },
   {
    "bn": "মুজিবনগর",
    "en": "Mujibnagar"
   },
   {
    "bn": "মেহেরপুর সদর",
    "en": "Meherpur Sadar"
   }
  ]
 },
 {
  "bn": "মৌলভীবাজার",
  "en": "Moulvibazar",
  "upazilas": [
   {
    "bn": "কমলগঞ্জ",
    "en": "Kamolganj"
   },
   {
    "bn": "কুলাউড়া",
    "en": "Kulaura"
   },
   {
    "bn": "জুড়ী",
    "en": "Juri"
   },
   {
    "bn": "বড়লেখা",
    "en": "Barlekha"
   },
   {
    "bn": "মৌলভীবাজার সদর",
    "en": "Moulvibazar Sadar"
   },
   {
    "bn": "রাজনগর",
    "en": "Rajnagar"
   },
   {
    "bn": "শ্রীমঙ্গল",
    "en": "Sreemangal"
   }
  ]
 },
 {
  "bn": "মুন্সিগঞ্জ",
  "en": "Munshiganj",
  "upazilas": [
   {
    "bn": "গজারিয়া",
    "en": "Gajaria"
   },
   {
    "bn": "টংগীবাড়ি",
    "en": "Tongibari"
   },
   {
    "bn": "মুন্সিগঞ্জ সদর",
    "en": "Munshiganj Sadar"
   },
   {
    "bn": "লৌহজং",
    "en": "Louhajanj"
   },
   {
    "bn": "শ্রীনগর",
    "en": "Sreenagar"
   },
   {
    "bn": "সিরাজদিখান",
    "en": "Sirajdikhan"
   }
  ]
 },
 {
  "bn": "ময়মনসিংহ",
  "en": "Mymensingh",
  "upazilas": [
   {
    "bn": "ঈশ্বরগঞ্জ",
    "en": "Iswarganj"
   },
   {
    "bn": "গফরগাঁও",
    "en": "Gafargaon"
   },
   {
    "bn": "গৌরীপুর",
    "en": "Gouripur"
   },
   {
    "bn": "তারাকান্দা",
    "en": "Tarakanda"
   },
   {
    "bn": "ত্রিশাল",
    "en": "Trishal"
   },
   {
    "bn": "ধোবাউড়া",
    "en": "Dhobaura"
   },
   {
    "bn": "নান্দাইল",
    "en": "Nandail"
   },
   {
    "bn": "ফুলপুর",
    "en": "Phulpur"
   },
   {
    "bn": "ফুলবাড়ীয়া",
    "en": "Fulbaria"
   },
   {
    "bn": "ভালুকা",
    "en": "Bhaluka"
   },
   {
    "bn": "ময়মনসিংহ সদর",
    "en": "Mymensingh Sadar"
   },
   {
    "bn": "মুক্তাগাছা",
    "en": "Muktagacha"
   },
   {
    "bn": "হালুয়াঘাট",
    "en": "Haluaghat"
   }
  ]
 },
 {
  "bn": "নওগাঁ",
  "en": "Naogaon",
  "upazilas": [
   {
    "bn": "আত্রাই",
    "en": "Atrai"
   },
   {
    "bn": "ধামইরহাট",
    "en": "Dhamoirhat"
   },
   {
    "bn": "নওগাঁ সদর",
    "en": "Naogaon Sadar"
   },
   {
    "bn": "নিয়ামতপুর",
    "en": "Niamatpur"
   },
   {
    "bn": "পত্নীতলা",
    "en": "Patnitala"
   },
   {
    "bn": "পোরশা",
    "en": "Porsha"
   },
   {
    "bn": "বদলগাছী",
    "en": "Badalgachi"
   },
   {
    "bn": "মহাদেবপুর",
    "en": "Mohadevpur"
   },
   {
    "bn": "মান্দা",
    "en": "Manda"
   },
   {
    "bn": "রাণীনগর",
    "en": "Raninagar"
   },
   {
    "bn": "সাপাহার",
    "en": "Sapahar"
   }
  ]
 },
 {
  "bn": "নড়াইল",
  "en": "Narail",
  "upazilas": [
   {
    "bn": "কালিয়া",
    "en": "Kalia"
   },
   {
    "bn": "নড়াইল সদর",
    "en": "Narail Sadar"
   },
   {
    "bn": "লোহাগড়া",
    "en": "Lohagara"
   }
  ]
 },
 {
  "bn": "নারায়ণগঞ্জ",
  "en": "Narayanganj",
  "upazilas": [
   {
    "bn": "আড়াইহাজার",
    "en": "Araihazar"
   },
   {
    "bn": "নারায়নগঞ্জ সদর",
    "en": "Narayanganj Sadar"
   },
   {
    "bn": "বন্দর",
    "en": "Bandar"
   },
   {
    "bn": "রূপগঞ্জ",
    "en": "Rupganj"
   },
   {
    "bn": "সোনারগাঁ",
    "en": "Sonargaon"
   }
  ]
 },
 {
  "bn": "নরসিংদী",
  "en": "Narsingdi",
  "upazilas": [
   {
    "bn": "নরসিংদী সদর",
    "en": "Narsingdi Sadar"
   },
   {
    "bn": "পলাশ",
    "en": "Palash"
   },
   {
    "bn": "বেলাবো",
    "en": "Belabo"
   },
   {
    "bn": "মনোহরদী",
    "en": "Monohardi"
   },
   {
    "bn": "রায়পুরা",
    "en": "Raipura"
   },
   {
    "bn": "শিবপুর",
    "en": "Shibpur"
   }
  ]
 },
 {
  "bn": "নাটোর",
  "en": "Natore",
  "upazilas": [
   {
    "bn": "গুরুদাসপুর",
    "en": "Gurudaspur"
   },
   {
    "bn": "নলডাঙ্গা",
    "en": "Naldanga"
   },
   {
    "bn": "নাটোর সদর",
    "en": "Natore Sadar"
   },
   {
    "bn": "বড়াইগ্রাম",
    "en": "Baraigram"
   },
   {
    "bn": "বাগাতিপাড়া",
    "en": "Bagatipara"
   },
   {
    "bn": "লালপুর",
    "en": "Lalpur"
   },
   {
    "bn": "সিংড়া",
    "en": "Singra"
   }
  ]
 },
 {
  "bn": "নেত্রকোণা",
  "en": "Netrokona",
  "upazilas": [
   {
    "bn": "আটপাড়া",
    "en": "Atpara"
   },
   {
    "bn": "কলমাকান্দা",
    "en": "Kalmakanda"
   },
   {
    "bn": "কেন্দুয়া",
    "en": "Kendua"
   },
   {
    "bn": "খালিয়াজুরী",
    "en": "Khaliajuri"
   },
   {
    "bn": "দুর্গাপুর",
    "en": "Durgapur"
   },
   {
    "bn": "নেত্রকোণা সদর",
    "en": "Netrokona Sadar"
   },
   {
    "bn": "পূর্বধলা",
    "en": "Purbadhala"
   },
   {
    "bn": "বারহাট্টা",
    "en": "Barhatta"
   },
   {
    "bn": "মদন",
    "en": "Madan"
   },
   {
    "bn": "মোহনগঞ্জ",
    "en": "Mohongonj"
   }
  ]
 },
 {
  "bn": "নীলফামারী",
  "en": "Nilphamari",
  "upazilas": [
   {
    "bn": "কিশোরগঞ্জ",
    "en": "Kishorganj"
   },
   {
    "bn": "জলঢাকা",
    "en": "Jaldhaka"
   },
   {
    "bn": "ডিমলা",
    "en": "Dimla"
   },
   {
    "bn": "ডোমার",
    "en": "Domar"
   },
   {
    "bn": "নীলফামারী সদর",
    "en": "Nilphamari Sadar"
   },
   {
    "bn": "সৈয়দপুর",
    "en": "Syedpur"
   }
  ]
 },
 {
  "bn": "নোয়াখালী",
  "en": "Noakhali",
  "upazilas": [
   {
    "bn": "কবিরহাট",
    "en": "Kabirhat"
   },
   {
    "bn": "কোম্পানীগঞ্জ",
    "en": "Companiganj"
   },
   {
    "bn": "চাটখিল",
    "en": "Chatkhil"
   },
   {
    "bn": "নোয়াখালী সদর",
    "en": "Noakhali Sadar"
   },
   {
    "bn": "বেগমগঞ্জ",
    "en": "Begumganj"
   },
   {
    "bn": "সুবর্ণচর",
    "en": "Subarnachar"
   },
   {
    "bn": "সেনবাগ",
    "en": "Senbug"
   },
   {
    "bn": "সোনাইমুড়ী",
    "en": "Sonaimori"
   },
   {
    "bn": "হাতিয়া",
    "en": "Hatia"
   }
  ]
 },
 {
  "bn": "পাবনা",
  "en": "Pabna",
  "upazilas": [
   {
    "bn": "আটঘরিয়া",
    "en": "Atghoria"
   },
   {
    "bn": "ঈশ্বরদী",
    "en": "Ishurdi"
   },
   {
    "bn": "চাটমোহর",
    "en": "Chatmohar"
   },
   {
    "bn": "পাবনা সদর",
    "en": "Pabna Sadar"
   },
   {
    "bn": "ফরিদপুর",
    "en": "Faridpur"
   },
   {
    "bn": "বেড়া",
    "en": "Bera"
   },
   {
    "bn": "ভাঙ্গুড়া",
    "en": "Bhangura"
   },
   {
    "bn": "সাঁথিয়া",
    "en": "Santhia"
   },
   {
    "bn": "সুজানগর",
    "en": "Sujanagar"
   }
  ]
 },
 {
  "bn": "পঞ্চগড়",
  "en": "Panchagarh",
  "upazilas": [
   {
    "bn": "আটোয়ারী",
    "en": "Atwari"
   },
   {
    "bn": "তেতুলিয়া",
    "en": "Tetulia"
   },
   {
    "bn": "দেবীগঞ্জ",
    "en": "Debiganj"
   },
   {
    "bn": "পঞ্চগড় সদর",
    "en": "Panchagarh Sadar"
   },
   {
    "bn": "বোদা",
    "en": "Boda"
   }
  ]
 },
 {
  "bn": "পটুয়াখালী",
  "en": "Patuakhali",
  "upazilas": [
   {
    "bn": "কলাপাড়া",
    "en": "Kalapara"
   },
   {
    "bn": "গলাচিপা",
    "en": "Galachipa"
   },
   {
    "bn": "দশমিনা",
    "en": "Dashmina"
   },
   {
    "bn": "দুমকি",
    "en": "Dumki"
   },
   {
    "bn": "পটুয়াখালী সদর",
    "en": "Patuakhali Sadar"
   },
   {
    "bn": "বাউফল",
    "en": "Bauphal"
   },
   {
    "bn": "মির্জাগঞ্জ",
    "en": "Mirzaganj"
   },
   {
    "bn": "রাঙ্গাবালী",
    "en": "Rangabali"
   }
  ]
 },
 {
  "bn": "পিরোজপুর",
  "en": "Pirojpur",
  "upazilas": [
   {
    "bn": "কাউখালী",
    "en": "Kawkhali"
   },
   {
    "bn": "জিয়ানগর",
    "en": "Zianagar"
   },
   {
    "bn": "নাজিরপুর",
    "en": "Nazirpur"
   },
   {
    "bn": "নেছারাবাদ",
    "en": "Nesarabad"
   },
   {
    "bn": "পিরোজপুর সদর",
    "en": "Pirojpur Sadar"
   },
   {
    "bn": "ভান্ডারিয়া",
    "en": "Bhandaria"
   },
   {
    "bn": "মঠবাড়ীয়া",
    "en": "Mathbaria"
   }
  ]
 },
 {
  "bn": "রাজবাড়ী",
  "en": "Rajbari",
  "upazilas": [
   {
    "bn": "কালুখালী",
    "en": "Kalukhali"
   },
   {
    "bn": "গোয়ালন্দ",
    "en": "Goalanda"
   },
   {
    "bn": "পাংশা",
    "en": "Pangsa"
   },
   {
    "bn": "বালিয়াকান্দি",
    "en": "Baliakandi"
   },
   {
    "bn": "রাজবাড়ী সদর",
    "en": "Rajbari Sadar"
   }
  ]
 },
 {
  "bn": "রাজশাহী",
  "en": "Rajshahi",
  "upazilas": [
   {
    "bn": "গোদাগাড়ী",
    "en": "Godagari"
   },
   {
    "bn": "চারঘাট",
    "en": "Charghat"
   },
   {
    "bn": "তানোর",
    "en": "Tanore"
   },
   {
    "bn": "দুর্গাপুর",
    "en": "Durgapur"
   },
   {
    "bn": "পবা",
    "en": "Paba"
   },
   {
    "bn": "পুঠিয়া",
    "en": "Puthia"
   },
   {
    "bn": "বাগমারা",
    "en": "Bagmara"
   },
   {
    "bn": "বাঘা",
    "en": "Bagha"
   },
   {
    "bn": "মোহনপুর",
    "en": "Mohonpur"
   }
  ]
 },
 {
  "bn": "রাঙ্গামাটি",
  "en": "Rangamati",
  "upazilas": [
   {
    "bn": "কাউখালী",
    "en": "Kawkhali"
   },
   {
    "bn": "কাপ্তাই",
    "en": "Kaptai"
   },
   {
    "bn": "জুরাছড়ি",
    "en": "Juraichari"
   },
   {
    "bn": "নানিয়ারচর",
    "en": "Naniarchar"
   },
   {
    "bn": "বরকল",
    "en": "Barkal"
   },
   {
    "bn": "বাঘাইছড়ি",
    "en": "Baghaichari"
   },
   {
    "bn": "বিলাইছড়ি",
    "en": "Belaichari"
   },
   {
    "bn": "রাঙ্গামাটি সদর",
    "en": "Rangamati Sadar"
   },
   {
    "bn": "রাজস্থলী",
    "en": "Rajasthali"
   },
   {
    "bn": "লংগদু",
    "en": "Langadu"
   }
  ]
 },
 {
  "bn": "রংপুর",
  "en": "Rangpur",
  "upazilas": [
   {
    "bn": "কাউনিয়া",
    "en": "Kaunia"
   },
   {
    "bn": "গঙ্গাচড়া",
    "en": "Gangachara"
   },
   {
    "bn": "তারাগঞ্জ",
    "en": "Taragonj"
   },
   {
    "bn": "পীরগঞ্জ",
    "en": "Pirgonj"
   },
   {
    "bn": "পীরগাছা",
    "en": "Pirgacha"
   },
   {
    "bn": "বদরগঞ্জ",
    "en": "Badargonj"
   },
   {
    "bn": "মিঠাপুকুর",
    "en": "Mithapukur"
   },
   {
    "bn": "রংপুর সদর",
    "en": "Rangpur Sadar"
   }
  ]
 },
 {
  "bn": "সাতক্ষীরা",
  "en": "Satkhira",
  "upazilas": [
   {
    "bn": "আশাশুনি",
    "en": "Assasuni"
   },
   {
    "bn": "কলারোয়া",
    "en": "Kalaroa"
   },
   {
    "bn": "কালিগঞ্জ",
    "en": "Kaliganj"
   },
   {
    "bn": "তালা",
    "en": "Tala"
   },
   {
    "bn": "দেবহাটা",
    "en": "Debhata"
   },
   {
    "bn": "শ্যামনগর",
    "en": "Shyamnagar"
   },
   {
    "bn": "সাতক্ষীরা সদর",
    "en": "Satkhira Sadar"
   }
  ]
 },
 {
  "bn": "শরীয়তপুর",
  "en": "Shariatpur",
  "upazilas": [
   {
    "bn": "গোসাইরহাট",
    "en": "Gosairhat"
   },
   {
    "bn": "জাজিরা",
    "en": "Zajira"
   },
   {
    "bn": "ডামুড্যা",
    "en": "Damudya"
   },
   {
    "bn": "নড়িয়া",
    "en": "Naria"
   },
   {
    "bn": "ভেদরগঞ্জ",
    "en": "Bhedarganj"
   },
   {
    "bn": "শরিয়তপুর সদর",
    "en": "Shariatpur Sadar"
   }
  ]
 },
 {
  "bn": "শেরপুর",
  "en": "Sherpur",
  "upazilas": [
   {
    "bn": "ঝিনাইগাতী",
    "en": "Jhenaigati"
   },
   {
    "bn": "নকলা",
    "en": "Nokla"
   },
   {
    "bn": "নালিতাবাড়ী",
    "en": "Nalitabari"
   },
   {
    "bn": "শেরপুর সদর",
    "en": "Sherpur Sadar"
   },
   {
    "bn": "শ্রীবরদী",
    "en": "Sreebordi"
   }
  ]
 },
 {
  "bn": "সিরাজগঞ্জ",
  "en": "Sirajganj",
  "upazilas": [
   {
    "bn": "উল্লাপাড়া",
    "en": "Ullapara"
   },
   {
    "bn": "কাজীপুর",
    "en": "Kazipur"
   },
   {
    "bn": "কামারখন্দ",
    "en": "Kamarkhand"
   },
   {
    "bn": "চৌহালি",
    "en": "Chauhali"
   },
   {
    "bn": "তাড়াশ",
    "en": "Tarash"
   },
   {
    "bn": "বেলকুচি",
    "en": "Belkuchi"
   },
   {
    "bn": "রায়গঞ্জ",
    "en": "Raigonj"
   },
   {
    "bn": "শাহজাদপুর",
    "en": "Shahjadpur"
   },
   {
    "bn": "সিরাজগঞ্জ সদর",
    "en": "Sirajganj Sadar"
   }
  ]
 },
 {
  "bn": "সুনামগঞ্জ",
  "en": "Sunamganj",
  "upazilas": [
   {
    "bn": "ছাতক",
    "en": "Chhatak"
   },
   {
    "bn": "জগন্নাথপুর",
    "en": "Jagannathpur"
   },
   {
    "bn": "জামালগঞ্জ",
    "en": "Jamalganj"
   },
   {
    "bn": "তাহিরপুর",
    "en": "Tahirpur"
   },
   {
    "bn": "দক্ষিণ সুনামগঞ্জ",
    "en": "South Sunamganj"
   },
   {
    "bn": "দিরাই",
    "en": "Derai"
   },
   {
    "bn": "দোয়ারাবাজার",
    "en": "Dowarabazar"
   },
   {
    "bn": "ধর্মপাশা",
    "en": "Dharmapasha"
   },
   {
    "bn": "বিশ্বম্ভরপুর",
    "en": "Bishwambarpur"
   },
   {
    "bn": "মধ্যনগর",
    "en": "Madhyanagar"
   },
   {
    "bn": "শাল্লা",
    "en": "Shalla"
   },
   {
    "bn": "সুনামগঞ্জ সদর",
    "en": "Sunamganj Sadar"
   }
  ]
 },
 {
  "bn": "সিলেট",
  "en": "Sylhet",
  "upazilas": [
   {
    "bn": "ওসমানী নগর",
    "en": "Osmaninagar"
   },
   {
    "bn": "কানাইঘাট",
    "en": "Kanaighat"
   },
   {
    "bn": "কোম্পানীগঞ্জ",
    "en": "Companiganj"
   },
   {
    "bn": "গোয়াইনঘাট",
    "en": "Gowainghat"
   },
   {
    "bn": "গোলাপগঞ্জ",
    "en": "Golapganj"
   },
   {
    "bn": "জকিগঞ্জ",
    "en": "Zakiganj"
   },
   {
    "bn": "জৈন্তাপুর",
    "en": "Jaintiapur"
   },
   {
    "bn": "দক্ষিণ সুরমা",
    "en": "Dakshinsurma"
   },
   {
    "bn": "ফেঞ্চুগঞ্জ",
    "en": "Fenchuganj"
   },
   {
    "bn": "বালাগঞ্জ",
    "en": "Balaganj"
   },
   {
    "bn": "বিয়ানীবাজার",
    "en": "Beanibazar"
   },
   {
    "bn": "বিশ্বনাথ",
    "en": "Bishwanath"
   },
   {
    "bn": "সিলেট সদর",
    "en": "Sylhet Sadar"
   }
  ]
 },
 {
  "bn": "টাঙ্গাইল",
  "en": "Tangail",
  "upazilas": [
   {
    "bn": "কালিহাতী",
    "en": "Kalihati"
   },
   {
    "bn": "গোপালপুর",
    "en": "Gopalpur"
   },
   {
    "bn": "ঘাটাইল",
    "en": "Ghatail"
   },
   {
    "bn": "টাঙ্গাইল সদর",
    "en": "Tangail Sadar"
   },
   {
    "bn": "দেলদুয়ার",
    "en": "Delduar"
   },
   {
    "bn": "ধনবাড়ী",
    "en": "Dhanbari"
   },
   {
    "bn": "নাগরপুর",
    "en": "Nagarpur"
   },
   {
    "bn": "বাসাইল",
    "en": "Basail"
   },
   {
    "bn": "ভুয়াপুর",
    "en": "Bhuapur"
   },
   {
    "bn": "মধুপুর",
    "en": "Madhupur"
   },
   {
    "bn": "মির্জাপুর",
    "en": "Mirzapur"
   },
   {
    "bn": "সখিপুর",
    "en": "Sakhipur"
   }
  ]
 },
 {
  "bn": "ঠাকুরগাঁও",
  "en": "Thakurgaon",
  "upazilas": [
   {
    "bn": "ঠাকুরগাঁও সদর",
    "en": "Thakurgaon Sadar"
   },
   {
    "bn": "পীরগঞ্জ",
    "en": "Pirganj"
   },
   {
    "bn": "বালিয়াডাঙ্গী",
    "en": "Baliadangi"
   },
   {
    "bn": "রাণীশংকৈল",
    "en": "Ranisankail"
   },
   {
    "bn": "হরিপুর",
    "en": "Haripur"
   }
  ]
 }
];

/** Bangla text can be typed with a precomposed য়/ড়/ঢ় or with the two-character form; compare in canonical (NFC) form. */
export const nfc = (s?: string | null) => (s ?? '').normalize('NFC');
export const findDistrict = (bn?: string | null) => (bn ? BD_GEO.find((d) => nfc(d.bn) === nfc(bn)) : undefined);
