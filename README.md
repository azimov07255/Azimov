# Azimov — Pul boshqaruvi 💸

Pulni to'g'ri sarflash, tejash va kelajakdagi biznesga tayyorlanish uchun shaxsiy moliya ilovasi.
**Hech qanday server yoki o'rnatish kerak emas** — oddiy HTML/CSS/JS (PWA), ma'lumotlar faqat sizning qurilmangizda saqlanadi, offlayn ishlaydi, telefonga o'rnatish mumkin.

## Imkoniyatlar

| Bo'lim | Nima qiladi |
|---|---|
| **Bosh sahifa** | Sof boylik, 30 kunlik dinamika, hisoblar, «bugun xavfsiz sarflash» summasi, oy oxiri prognozi, moliyaviy salomatlik balli (0–100), xarajat diagrammasi, 6 oylik dinamika, aqlli maslahatlar |
| **Tez qo'shish** | «taksi 25 ming», «kafe 80k», «+maosh 5 mln» deb yozing — summa, kategoriya va turini o'zi aniqlaydi (bekor qilish tugmasi bilan) |
| **Tranzaksiyalar** | Daromad / xarajat / hisoblararo o'tkazma, qidiruv, filtr, oylar bo'yicha ko'rish |
| **Byudjet** | Kategoriya limitlari, progress, **avto-reja (50/30/20)** — o'tgan oylar xarajatiga qarab tuziladi |
| **Maqsadlar** | Avariya fondi, biznes kapitali, uy, mashina... Muddat bo'yicha «oyiga qancha ajratish kerak» hisobi |
| **Qarzlar** | «Men qarzdorman» / «Menga qarzdor», qisman to'lov, muddat eslatmasi, hisobga avtomatik yozish |
| **Takroriy to'lovlar** | Obuna, ijara, kredit; «To'landi» bosilsa tranzaksiya yoziladi va keyingi sana suriladi; yillik narx |
| **Biznes** | Har bir biznes uchun daromad/xarajat, doimiy xarajatlar, sof foyda, marja, **kapital qaytish muddati**, **zararsizlik nuqtasi** + «Biznesga tayyormisiz?» tekshiruv ro'yxati |
| **Asboblar** | Foiz/investitsiya, maqsadga qachon erishaman, kredit, avariya fondi, zararsizlik, 50/30/20, kichik xarajatlar kuchi, valyuta, 52 haftalik challenge |
| **Bank xabarlari** | SMS / Humo / Uzcard / Payme / Click xabarini joylang (yoki Android'da «Ulashish», iPhone'da Buyruqlar orqali yuboring) — summa, do'kon, karta, kategoriya va hisob avtomatik aniqlanadi; dublikatlar belgilanadi; tuzatgan kategoriyangiz keyingi safar eslab qolinadi |
| **Hisobotlar** | Oylik va yillik tahlil: xulosa matni, tavsiyalar, kategoriyalar (o'tgan oyga nisbatan), kunlik/hafta kunlari grafigi, eng katta xarajatlar, byudjet, bizneslar. **PDF** — «PDF» tugmasi → «PDF sifatida saqlash» |
| **Bulut va akkaunt** | Email/parol bilan kirish, qurilmalar o'rtasida avtomatik sinxronlash (Supabase), to'qnashuvda «birlashtirish / bulut / qurilma» tanlovi |
| **Oylik reja va «Oyni yopish»** | Byudjet sahifasida «har so'mga vazifa» o'lchovi (daromad − byudjet − maqsadlarga hissa = vazifasiz qolgan pul); oy oxirida natijani ko'rib, tejalgan pulni maqsadlarga taqsimlash, ketma-ket oylar «seriyasi» |
| **Chek skanerlash** | Chek rasmi → qurilmada OCR (Tesseract.js, lotin + kirill) → do'kon, jami summa, sana, kategoriya; tahrirlab qo'shasiz |
| **Eslatmalar** | To'lov/qarz muddati, byudjet 80%/100%, oyni yopish, kechki eslatma; qo'ng'iroqcha belgisi; ilova ochiq paytda tizim bildirishnomasi; **ilova yopiq paytda Web Push** (akkaunt kerak) |
| **Kunlik daromad** | Dada/aka kabi manbalar: qat'iy yoki oraliq summa, ish kunlari, har kuni yoki haftalik jamlab olish; har kun «Oldim / Ishladim / Dam»; hafta ko'rinishi, hisob-kitob, belgilanmagan kunlarni to'ldirish |
| **Yaxlitlab tejash** | Har xarajatni yaxlitlab (23 400 → 25 000), farqi avtomatik maqsadga; tahrirlash/o'chirish va bank importida ham izchil; haqiqiy pulni jamg'arma hisobiga ko'chirish |
| **Nima bo'ladi agar** | Kategoriya bo'yicha qisqartirish, daromad o'zgarishi, foyda va muddat → kelajak prognozi, maqsadga yetish vaqti, byudjetga qo'llash |
| **Qarzni tez yopish** | Foiz va minimal to'lov bilan 3 usul (qor ko'chkisi / eng qimmat foiz / muddat) solishtiriladi: necha oy, qancha foiz, qaysi tartibda |
| **PIN va barmoq izi qulfi** | PIN (PBKDF2 hash) + Face ID / barmoq izi (WebAuthn), 5 xatodan keyin o'suvchi kutish, avto-qulf, ilovalar oynasida summalarni yashirish. Eslatma: bu begonalarni ilovaga kiritmaydigan qulf, disk shifrlash emas |
| **Markaziy bank kursi** | USD/EUR/RUB kursi cbu.uz dan avtomatik (Edge Function orqali), valyuta konvertori va bank xabarlaridagi chet el valyutasini o'giradi |
| **Zakat va sadaqa** | Nisab o'lchovini (hanafiy/boshqa) tanlab 2,5% hisob-kitobi, yil (havl) sanasi, berilgan zakat/sadaqa daftari. Yordamchi vosita, fatvo emas |
| **Yangi versiya xabari** | Yangi versiya joylansa, ochiq ilovada «Yangilash» paneli va «Nima yangi?» ro'yxati chiqadi |
| **Sozlamalar** | Hisoblar, o'z kategoriyalaringiz, valyuta (UZS/USD/EUR/RUB), qorong'i/yorug' mavzu, summalarni yashirish, JSON zaxira va tiklash, CSV eksport |

## Ishga tushirish

```bash
python3 -m http.server 8080   # yoki: npx serve
```

So'ng brauzerda `http://localhost:8080` oching. Birinchi ochilganda **«Demo ma'lumot bilan ko'rish»** tugmasi barcha bo'limlarni to'ldirilgan holda ko'rsatadi.

Internetga chiqarish uchun papkani GitHub Pages / Netlify / Vercel'ga yuklash kifoya (build kerak emas).
Telefonda: brauzer menyusidan **«Bosh ekranga qo'shish»**.

## Tuzilma

```
index.html            kirish nuqtasi
css/styles.css        dizayn tizimi (qorong'i/yorug' mavzu)
js/app.js             router, shell, onboarding
js/store.js           holat + localStorage
js/insights.js        prognoz, salomatlik balli, aqlli maslahatlar
js/charts.js          SVG grafiklar (donut, bar, area, ring)
js/reminders-core.js  eslatma qoidalari (toza, serverda ham ishlatiladi)
js/notify.js, push.js  bildirishnomalar va Web Push obunasi
js/receipt.js         chek matni parseri; views/scan.js — OCR sahifasi
js/planner.js         toza hisob-kitob: yaxlitlash, prognoz, qarz grafigi
js/streams.js         kunlik daromad manbalari va kun yozuvlari
js/sync.js            Supabase auth + sinxronlash + to'qnashuvlarni hal qilish
js/sms.js             bank xabarlari parseri (sof funksiyalar)
supabase/migrations   bulut jadvali va RLS siyosatlari
js/views/*.js         har bir bo'lim
```

## Bulut sinxronizatsiyasi (Supabase)

1. Supabase loyihasi oching va `supabase/migrations/*.sql` ni SQL Editor'da ishga tushiring (jadval `azimov_user_data`, RLS bilan: har kim faqat o'z qatorini ko'radi).
2. `js/config.js` dagi `SUPABASE_URL` va `SUPABASE_KEY` (anon/publishable kalit — ochiq bo'lishi xavfsiz) ni o'zingizniki bilan almashtiring.
3. Supabase → Authentication → URL Configuration: **Site URL** ga ilova manzilini yozing (tasdiqlash xati shu manzilga qaytaradi). Email tasdiqlash xohlamasangiz, Providers → Email → «Confirm email» ni o'chiring.

Ishlash tartibi: har bir foydalanuvchining ma'lumoti bitta JSON nusxa sifatida saqlanadi; `rev` hisoblagichi (DB trigger oshiradi) orqali ikki qurilma bir vaqtda o'zgartirsa to'qnashuv aniqlanadi. Ilova internetsiz ham to'liq ishlaydi — o'zgarishlar internet qaytganda yuboriladi.

## Eslatmalar (Web Push) — server qismi

- `supabase/migrations/*_azimov_push.sql` — `azimov_push_subs` (qurilma obunalari, RLS), `azimov_push_log` (takror yubormaslik), `azimov_private` (faqat server o'qiydi).
- `supabase/functions/azimov-notify` — Edge Function. VAPID kalit juftini birinchi chaqiruvda o'zi yaratadi va `azimov_private` da saqlaydi (panelda secret kiritish shart emas); ilova faqat **ochiq** kalitni `?pubkey` orqali oladi.
- `supabase/cron.sql.example` — pg_cron har 10 daqiqada funksiyani chaqiradi. O'chirish: `select cron.unschedule('azimov-notify');`
- `js/reminders-core.js` va `supabase/functions/azimov-notify/core.js` **bir xil fayl** bo'lishi shart (qoidalar brauzerda ham, serverda ham bir xil). O'zgartirsangiz ikkalasini yangilang.
- iPhone: faqat bosh ekranga qo'shilgan ilovada (iOS 16.4+). Foydalanuvchi akkauntga kirib, «Eslatmalar → Bildirishnomalarni yoqish» ni bosadi.

## Yangi versiya chiqarish (muhim)

Ilova ochiq turgan foydalanuvchiga yangilanishni ko'rsatishi uchun har joylashdan oldin:

```bash
# 1) CHANGELOG.json ning boshiga yangi yozuv qo'shing (versiya, sana, "Nima yangi" ro'yxati)
# 2) belgini yangilang:
node scripts/stamp-version.mjs
# 3) commit qiling (version.json va js/version.js ham commit ichida bo'lsin)
```

`node scripts/stamp-version.mjs --check` belgi eskirganini aniqlaydi (CI yoki git `pre-commit` hook'ida ishlatish mumkin).
Edge Functions: `azimov-notify` (eslatmalar), `azimov-rates` (Markaziy bank kursi, ochiq va faqat o'qish).

## Bank xabarlari haqida halol eslatma

Brauzer (PWA) telefon SMS qutisini **o'zi o'qiy olmaydi** — bu operatsion tizim cheklovi. Shuning uchun xabar *joylanadi* yoki Android «Ulashish» / iPhone «Buyruqlar» avtomatlashtirishi orqali ilovaga *yuboriladi*. To'liq avtomatik o'qish uchun SMS ruxsatli Android ilova (masalan Capacitor bilan o'rash) kerak bo'ladi.
Parser Humo/Uzcard/Payme/Click uchun keng tarqalgan formatlarga moslangan; formati kutilmagan xabar bo'lsa, sahifadagi maydonlarni qo'lda tuzatish mumkin.

## Maxfiylik

Akkaunt ulamasangiz, barcha ma'lumotlar faqat brauzer `localStorage` xotirasida va hech narsa serverga yuborilmaydi. Akkaunt ulasangiz, nusxa Supabase'dagi sizning qatoringizda saqlanadi (RLS himoyasi bilan). Bank xabarlari tahlili butunlay qurilmada bajariladi. Qurilmani almashtirsangiz — «Zaxira nusxa (JSON)» orqali ko'chiring.
