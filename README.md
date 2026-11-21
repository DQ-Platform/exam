# DQ Platform

Dövlət qulluğu üzrə sınaq və fənn testləri platforması. Statik front-end (HTML/JS/CSS) və Cloudflare Worker, verilənlər bazası kimi Supabase istifadə olunur.

Ünvan: https://exam.dqplatform.workers.dev

## Layihənin quruluşu

| Fayl / qrup | Təyinatı |
|---|---|
| `index.html` | Əsas tətbiq (giriş nöqtəsi). Skriptlər `?v=N` ilə çağırılır |
| `app.js`, `dq-*.js`, `yspro.js`, `sual-studio.js`, `chatbot.js` | Tətbiq modulları (`index.html`-də yüklənmə sırası ilə) |
| `dq-*.css` | Üslublar: `dq-premium.css`, `dq-redesign.css`, `dq-premium-pro.css`, `dq-design.css`; `dq-ui.css` (vahid UI sistemi: düymə, forma, cədvəl, tab, modal, nişan; bütün səhifələrdə ən sonda); **`dq-gov.css` ana səhifənin rəsmi görünüşünü təyin edir** və ana səhifənin rəsmi (açıq fon, tünd göy) görünüşünü təyin edir |
| `giris.html`, `imtahan-giris.html` | İmtahana giriş səhifələri |
| `admin.html`, `Kabinet.html`, `Operator.html`, `merkez.html`, `redakte.html`, `Idare.html`, `Kod.html`, `Kontrol.html`, `Pult.html`, `Siyaha.html`, `Statistika.html`, `Suallar.html`, `Cavablar.html`, `modul.html` | İdarəetmə səhifələri (`noindex`) |
| `pdf-studio.html`, `pdf.html`, `fon-temizle.html`, `elan-idareetme.html`, `proysl.html` | Köməkçi alətlər |
| `worker.js` | Cloudflare Worker: `/news`, `/news-img`, `/qeydiyyat`, `/test`, `/sinaq`, `/cover/*`, `/push/*` |
| `cf-worker.js` | Ayrıca Worker: şəkil yükləmə (R2, `POST /upload`). `dq-qpro.js` istifadə edir |
| `service-worker.js` | PWA və push bildirişləri |
| `manifest.json`, `icon-*.png`, `favicon.png`, `apple-touch-icon.png` | PWA |
| `rls.sql` | Supabase RLS qaydaları |
| `_headers`, `.assetsignore`, `wrangler.jsonc` | Yerləşdirmə konfiqurasiyası |

## Yerləşdirmə (Cloudflare)

```
npx wrangler deploy
```

`worker.js` üçün gizli açarlar (Settings → Variables and Secrets): `VAPID_PRIVATE`, `ADMIN_KEY`; istəyə bağlı `VAPID_SUBJECT`.

## Yeniləmə qaydası

Skript və ya üslub faylı dəyişəndə `index.html`-də həmin faylın `?v=N` nömrəsini artırın.

## Keşləmə və yükləmə

`_headers` hər fayl üçün tək `Cache-Control` təyin edir (JS/CSS 1 gün + 7 gün arxa fonda yenilənmə, şəkillər 30 gün, `service-worker.js` həmişə təzə yoxlanır). Fayl dəyişəndə `?v=N` nömrəsini artırın.
