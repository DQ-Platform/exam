# DQ Platform — Dövlət qulluğu onlayn sınaq platforması

Canlı sayt: https://exam.dqplatform.workers.dev/ · Hosting: Cloudflare Workers (static assets) · Verilənlər: Firestore (Supabase REST sorğuları `dq-firebase.js` körpüsü ilə yönləndirilir)

## Əsas fayllar
| Fayl | Rolu |
|---|---|
| `index.html` | Əsas tətbiq (SPA). Bütün `dq-*.js` modulları buradan yüklənir |
| `app.js` | İmtahan mühərriki, admin, nəticə |
| `dq-giris.js` | Giriş linki (`?giris=1`) ilə tələbə kabineti: sınaq siyahısı, başlama, davam etmə |
| `giris.html` | Təmiz giriş səhifəsi (link açılanda `dq-giris.js`-ə təhvil verir) |
| `dq-imtahan-giris.js` | Ana səhifədəki sınaq siyahısı, «İş nömrəsi ilə davam et» |
| `dq-firebase.js` | Supabase → Firestore körpüsü (index.html-də ilk skript olmalıdır) |
| `_headers` | Keş qaydaları |
| `worker.js`, `wrangler.jsonc` | Cloudflare Worker marşrutları (`/news`, `/qeydiyyat`, `/push/*`) |

## Yeniləmə qaydası
1. Faylı dəyişəndə `index.html`-dəki `?v=N` rəqəmini artırın (məs. `dq-giris.js?v=16` → `17`).
2. `_headers` kod fayllarını hər dəfə yoxlayır, ona görə dəyişiklik istifadəçiyə dərhal çatır.
3. Gizli açarları (Cloudflare tokeni, `service_role`, VAPID private) heç vaxt repoya qoymayın — Worker «Variables and Secrets» bölməsində saxlayın.

## Məlum qeydlər
- `index.html` əvvəllər repoda olmayan `dq-ceo.js`, `dq-copy2.js`, `dq-home-sliders.js`, `dq-sekil-alet.js` fayllarını çağırırdı. Çağırışlar silinib; fayllar tapılsa əlavə edib `index.html`-ə qaytarın.
- İstifadə olunmayan (heç bir faylda çağırılmayan) fayllar: `dq-pro-v2.js`, `dq-pro-fix.js`, `dq-an-pro.js`, `dq-an-stats.js`, `dq-wallet.js`, `dq-mv-link.js`, `imtahan-giris.html`, `sw.js`, `cf-worker.js` və s. Silməzdən əvvəl ehtiyat nüsxə saxlayın.
