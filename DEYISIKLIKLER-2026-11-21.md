# Mərkəzi baza möhkəmləndirilməsi — 21 Noyabr 2026

## Əlaqə qatı (dq-firebase.js v2)
- Hər Firestore əməliyyatına 15 san vaxt-aşımı + 3 təkrar cəhd (300/900/2000 ms backoff)
- Firebase açılmasa avtomatik yenidən qoşulma (v1-də bir dəfəlik xəta həmişəlik qalırdı)
- Əlaqə statusu: `DQDB.status()`, `DQDB.onChange(fn)`, `DQDB.info()`, `DQDB.ping()`; yalnız problem olanda görünən kiçik status zolağı
- Baza əlçatmaz olanda oxu sorğularında son uğurlu nəticə qaytarılır (header: X-DQ-Stale)
- Firestore lokal keşi (persistentLocalCache), `/auth/v1/health` → 200
- dq-net.js: baza qatı artıq təkrar cəhd edibsə ikiqat gözləmə yoxdur

## Bazadan ayrı qalan hissələr bağlandı
- Köhnə Supabase-ə birbaşa qoşulan 11 səhifəyə baza qatı əlavə edildi: Idare, Kabinet, Siyaha, Statistika, modul, redakte, Cavablar, pdf, pdf-studio, fon-temizle, elan-idareetme
- merkez.html: avtomatik qoşulur, real cədvəllərə yazır/oxuyur (exam_questions, allowed_students, exam_results, dq_v2_store); saxta/statik sətirlər və işləməyən "Pult" silindi
- worker.js: xəbər önizləmə, qapaq şəkli, qeydiyyat kartı, push abunələri → Firestore REST
- service-worker.js: push mətni mərkəzi bazadan (v5)

## Təmizlik
- index.html: 404 verən 4 script silindi (dq-ceo, dq-copy2, dq-home-sliders, dq-sekil-alet)
- Silinən istifadəsiz fayllar (15): cf-worker, dq-admin-kecid, dq-an-pro, dq-an-stats, dq-mv-link, dq-pro-fix, dq-pro-v2, dq-recommend, dq-wallet, news-og-worker, news-share-worker, worker-news-og, worker-og-preview, worker-redirect-fix, sw
- 9 istifadəsiz funksiya silindi (app.js, dq-pdf-engine, dq-pdf-pro, dq-pdf-secim, sual-studio)
- `<U+200B>Cavablar.html` → `Cavablar.html` (Operator.html-dəki keçid işləmirdi)
