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
js/views/*.js         har bir bo'lim
```

## Maxfiylik

Barcha ma'lumotlar brauzer `localStorage` xotirasida. Hech narsa serverga yuborilmaydi. Qurilmani almashtirsangiz — «Zaxira nusxa (JSON)» orqali ko'chiring.
