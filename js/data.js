export const DEFAULT_CATS = [
  { id: 'c_food', name: 'Oziq-ovqat', icon: '🛒', color: '#34d399', type: 'expense', grp: 'need' },
  { id: 'c_home', name: 'Uy-joy va kommunal', icon: '🏠', color: '#60a5fa', type: 'expense', grp: 'need' },
  { id: 'c_transport', name: 'Transport', icon: '🚕', color: '#fbbf24', type: 'expense', grp: 'need' },
  { id: 'c_phone', name: 'Aloqa va internet', icon: '📱', color: '#22d3ee', type: 'expense', grp: 'need' },
  { id: 'c_health', name: "Sog'liq", icon: '💊', color: '#fb7185', type: 'expense', grp: 'need' },
  { id: 'c_edu', name: "Ta'lim", icon: '📚', color: '#a78bfa', type: 'expense', grp: 'need' },
  { id: 'c_family', name: 'Oila va bolalar', icon: '👨‍👩‍👧', color: '#f472b6', type: 'expense', grp: 'need' },
  { id: 'c_debt', name: "Qarz to'lovi", icon: '💳', color: '#f87171', type: 'expense', grp: 'need' },
  { id: 'c_cafe', name: 'Kafe va restoran', icon: '☕', color: '#f59e0b', type: 'expense', grp: 'want' },
  { id: 'c_shop', name: 'Kiyim va xaridlar', icon: '🛍️', color: '#c084fc', type: 'expense', grp: 'want' },
  { id: 'c_fun', name: "Ko'ngil ochar", icon: '🎬', color: '#38bdf8', type: 'expense', grp: 'want' },
  { id: 'c_gift', name: "Sovg'a va xayriya", icon: '🎁', color: '#fb923c', type: 'expense', grp: 'want' },
  { id: 'c_subs', name: 'Obunalar', icon: '🔁', color: '#818cf8', type: 'expense', grp: 'want' },
  { id: 'c_other', name: 'Boshqa', icon: '🧾', color: '#94a3b8', type: 'expense', grp: 'want' },
  { id: 'i_salary', name: 'Maosh', icon: '💰', color: '#34d399', type: 'income' },
  { id: 'i_biz', name: 'Biznes daromadi', icon: '🏪', color: '#22d3ee', type: 'income' },
  { id: 'i_free', name: 'Frilans', icon: '💻', color: '#a78bfa', type: 'income' },
  { id: 'i_invest', name: 'Investitsiya', icon: '📈', color: '#fbbf24', type: 'income' },
  { id: 'i_gift', name: "Sovg'a", icon: '🎉', color: '#f472b6', type: 'income' },
  { id: 'i_other', name: 'Boshqa daromad', icon: '💵', color: '#94a3b8', type: 'income' },
];

export const EMOJI = ['💵', '💳', '🏦', '👛', '💰', '🏠', '🚗', '✈️', '🎓', '💍', '📱', '💻', '🏪', '🚀', '🛡️', '🌴', '🕋', '👶', '🎁', '📈', '🍔', '☕', '🛒', '🎬', '💊', '🏋️', '🐄', '🌾', '🛠️', '📦'];
export const COLORS = ['#7c5cff', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#f472b6', '#60a5fa', '#fb923c', '#a78bfa', '#2dd4bf'];

export const ACCOUNT_TYPES = [
  ['cash', 'Naqd pul'],
  ['card', 'Plastik karta'],
  ['savings', "Jamg'arma"],
  ['business', 'Biznes hisobi'],
  ['other', 'Boshqa'],
];

// keyword -> category for the smart quick-add parser
export const KEYWORDS = [
  ['c_transport', /taksi|taxi|yandex|metro|avtobus|bus\b|benzin|yoqilg|gaz\b|propan|transport|mashina|parkovka|inDrive|indrive|mytaxi/i],
  ['c_food', /non\b|go'?sht|bozor|market|korzinka|makro|oziq|sabzavot|meva|sut\b|tuxum|yog'?\b|guruch|un\b|magazin|do'?kon|havas|baraka/i],
  ['c_cafe', /kafe|cafe|restoran|coffee|kofe|choy|osh\b|lavash|burger|fast|pizza|shashlik|kfc|evos|oqtepa|ovqat|tushlik|nonushta|kechki/i],
  ['c_phone', /internet|telefon|beeline|ucell|uzmobile|mobil|humans|aloqa|wifi|wi-fi|sim\b|paynet/i],
  ['c_home', /kommunal|ijara|arenda|svet\b|elektr|suv\b|issiqlik|uy\b|kvartira|remont|mebel/i],
  ['c_health', /dori|apteka|shifokor|vrach|klinika|tish|analiz|kasalxona|sog'?liq/i],
  ['c_shop', /kiyim|poyabzal|krossovka|ko'?ylak|shim\b|kurtka|aksessuar|texnika|noutbuk|xarid/i],
  ['c_edu', /kurs|kitob|o'?qish|universitet|kontrakt|maktab|repetitor|ta'?lim|dars/i],
  ['c_fun', /kino|o'?yin|game|konsert|teatr|park|dam olish|sayohat|safar|bilet/i],
  ['c_gift', /sovg'?a|tug'?ilgan|to'?y\b|xayriya|sadaqa|hadya|gul\b/i],
  ['c_subs', /netflix|spotify|youtube|obuna|premium|icloud|chatgpt|subscription/i],
  ['c_family', /bola|farzand|bog'?cha|oila|ota-ona|ona\b|ota\b/i],
  ['c_debt', /qarz|kredit|nasiya|bank to'?lov/i],
  ['i_salary', /maosh|oylik|avans|zarplata|ish haqi/i],
  ['i_free', /frilans|freelance|loyiha|buyurtma|upwork|fiverr/i],
  ['i_biz', /biznes|savdo|foyda|sotuv/i],
  ['i_invest', /dividend|foiz|investitsiya|depozit|aksiya/i],
];
