# DQ Platform — texniki audit və dəyişiklik qeydi

## Bu paketdə edilən dəyişikliklər

### 1. Resepşin / icazə idarəetməsi (`dq-resepsiya.js`)
- Məlumat sorğularında əvvəlcə vahid `DQ.client` mərkəzi klientindən istifadə edilir.
- Baza sxeminin oxunması uğursuz olarsa, yanlış sütun adları ilə davam etmək əvəzinə xəta göstərilir.
- İş nömrələrinin yaradılması `crypto.getRandomValues()` ilə aparılır; `Math.random()` istifadə edilmir.
- Unikallıq yoxlamasındakı baza xətaları artıq “nömrə boşdur” kimi qəbul edilmir.
- Yazma əməliyyatları mövcud olduqda `DQ.write()` üzərindən aparılır ki, keş ləğvi və digər panellərə dəyişiklik siqnalı yayılsın.
- İcazə siyahısı 100 qeydə qədər yüklənir, `created_at` sıralaması alınmasa alternativ sorğu sınanır.
- Yükləmə xətası gizlədilmir; istifadəçiyə xəta və yenidən yoxlama imkanı göstərilir.
- Resepşin açıq olduğu müddətdə mərkəzi bazadakı dəyişikliklər `DQ.watch()` ilə izlənir (5 saniyəlik yoxlama, tab görünəndə və bağlantı bərpa olunanda yeniləmə).
- “Yeni şəxs” forması sıfırlanarkən kateqoriya seçimləri və düymə vəziyyəti də sıfırlanır.

### 2. Ayrı admin səhifəsi (`admin.html`)
- İcazə əlavə edildikdən və silindikdən sonra tələbə siyahısı məcburi şəkildə mərkəzi bazadan yenidən oxunur.
- “Hamısını yenilə” əməliyyatı preload məlumatları ilə yanaşı tələbə siyahısını da yeniləyir.
- Giriş zamanı yaranan istisnalar istifadəçiyə göstərilir və giriş düyməsi mütləq aktiv vəziyyətə qaytarılır.

### 3. Admin keçid modulu (`dq-admin-fix.js`)
- Admin yoxlaması artıq `localStorage`-da saxlanılan `dq_admin_logged` dəyərini təkbaşına etibarlı giriş saymır.
- `DQAdminFix` obyektindən birbaşa `grant`, `menu`, `editor` və `central` funksiyalarının açıq çağırışları çıxarılıb. Admin girişinin əsas açılış nöqtəsi parol yoxlamalı `open()` funksiyasıdır.

## Yoxlama nəticəsi
- Layihədəki 58 xarici JavaScript faylı `node --check` ilə yoxlanılıb: sintaksis xətası aşkarlanmayıb.
- HTML fayllarında 105 daxili script bloku tapılıb. JavaScript olan bloklarda sintaksis xətası yoxdur; iki blok JavaScript deyil (JSON-LD məlumatı və HTML şablon məzmunu) və buna görə JS parser yoxlamasına daxil edilmir.

## Vacib: canlı bazada hələ təsdiqlənməmiş məsələlər

Bu ZIP-dən istifadə etməklə real Supabase/Firebase/Cloudflare hesablarına giriş və canlı əməliyyat testi aparmaq mümkün deyil. Buna görə “bütün funksiyalar 100% işləyir” və ya “qüsursuzdur” zəmanəti vermək düzgün olmaz. Aşağıdakılar server tərəfində yoxlanmalıdır:

1. `rls.sql` daxilində `allowed_students`, `exam_results`, `exam_questions` üçün ictimai SELECT siyasətləri var. Xüsusilə tələbə FIN/iş nömrələri və imtahan nəticələri kimi məlumatların ictimai oxunması məxfilik riski yaradır.
2. `dq_v2_store` üçün siyasət bir çox kolleksiyanı ictimai oxunaqlı edir. Həmin cədvəldə şəxsi və ya əməliyyat məlumatları varsa, kolleksiya üzrə ayrıca RLS qaydaları tələb olunur.
3. `rls.sql` admin yazmalarını Supabase Auth JWT-də `dqplatform7@gmail.com` e-poçtuna bağlayır. Əsas tətbiqin bəzi admin giriş yolları isə brauzer daxilindəki kod yoxlamasına əsaslanır. Bu iki mexanizm eyni deyil; RLS aktivdirsə, admin kimi görünən brauzer sessiyasının yazma icazəsi olmaya bilər.
4. `app.js` daxilində müştəri tərəfə daxil edilmiş admin giriş sirri var. Brauzerə göndərilən heç bir parol və ya gizli açar sirr sayıla bilməz. Admin autentifikasiyası server tərəfə / Supabase Auth-a keçirilməli, bütün yazma əməliyyatları RLS və ya qorunan server funksiyası ilə təsdiqlənməlidir.
5. Firestore təhlükəsizlik qaydaları, Supabase RLS-in faktiki tətbiq vəziyyəti, cədvəl sütunları/unikal indeksləri, Worker secret-ləri və canlı bağlantı gecikmələri bu mühitdən yoxlanılmayıb.

## İstehsala buraxılışdan əvvəl tələb olunan canlı sınaqlar
- Admin hesabı ilə giriş və çıxış; başqa istifadəçi ilə admin girişinin rədd edilməsi.
- İcazə yaratma, eyni FIN/sınaq üçün təkrar yaratmanın bloklanması, redaktə, kateqoriya əlavə/silmə.
- İki ayrı cihazda eyni anda dəyişiklik edildikdə siyahıların yenilənməsi.
- Sual bankı, imtahan, nəticə, elan, quiz və digər kolleksiyalarda CRUD əməliyyatları.
- Oflayn rejim, bağlantının bərpası, sorğu vaxt aşımı və təkrar cəhd.
- RLS testləri: anonim istifadəçi şəxsi tələbə məlumatlarını və nəticələri oxuya və dəyişə bilməməlidir.

**Qeyd:** Bu paketdə edilənlər konkret kod düzəlişləri və statik yoxlamalardır. Server konfiqurasiyası və real hesabda inteqrasiya sınaqları tamamlanmadan tam funksionallıq təsdiqlənmiş sayılmır.
