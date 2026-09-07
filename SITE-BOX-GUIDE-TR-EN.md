# Bet Project — Sayfa Kutuları ve Bilgi Rehberi / Page Box Guide

Bu belge, sitedeki her ana sayfanın üst başlıklı kutularını ve bu kutuların hangi bilgileri verdiğini açıklar. Dil seçimi sol menüdeki **TR / EN** düğmeleriyle yapılır; seçim tarayıcıda saklanır.

This document explains the titled cards and panels on every main page and the information they provide. Use the **TR / EN** buttons in the sidebar to switch language; the choice is saved in the browser.

## Yönetici sayfaları / Administrator pages

### `/admin-dashboard` — Tahmin Kontrol Paneli / Prediction Dashboard

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Canlı Tahmin Adayları / Production Candidates | Seçim Politikası V2 filtresini geçen toplam yayımlanmış maç sayısıdır. | Total published matches that pass Selection Policy V2. |
| Yüksek Güvenilirlik / High Reliability | Güvenilirlik seviyesi yüksek veya çok yüksek olan adayları sayar. | Counts candidates rated High or Very High reliability. |
| Ortalama Güvenilirlik / Average Reliability | Yayımlanmış adayların birleşik model güvenilirliği ortalamasıdır. | Average combined-model reliability of published candidates. |
| Ortalama Olasılık / Average Probability | Her maç için seçilen nihai 1X2 sonucunun ortalama model olasılığıdır. | Average model probability of the selected final 1X2 outcome. |
| Deplasman İncelemesi / Away Review | Sınırlı ayrılmış test örneklemi nedeniyle ayrıca işaretlenen deplasman adaylarını gösterir. | Shows away candidates flagged because of the limited holdout sample. |
| Yaklaşan En Güçlü Maçlar / Strongest Upcoming Fixtures | En güçlü yayımlanmış tahminleri maç saatine göre sıralar; satır açıldığında analiz ayrıntıları görünür. | Lists the strongest published picks by kickoff; expanding a row reveals analysis details. |
| Etkin Tahmin İş Akışı / Active Prediction Pipeline | %20 ML → %80 Poisson → Politika V2 akışını, sezonu ve aday sayılarını özetler. | Summarizes the 20% ML → 80% Poisson → Policy V2 flow, season and candidate counts. |
| Yayımlama Filtresi / Publication Filter | Minimum olasılık, güvenilirlik, veri kalitesi ve izin verilen sonuç türlerini gösterir. | Shows minimum probability, reliability, data-quality and permitted outcome rules. |
| Sistem Durumu / System Status | Veritabanı, özellik, derecelendirme, tahmin, piyasa ve API bileşenlerinin durumunu gösterir. | Shows the state of database, feature, rating, prediction, market and API components. |
| Güvenilirlik Dağılımı / Reliability Distribution | Adayların güvenilirlik seviyelerine göre adet dağılımını verir. | Gives candidate counts by reliability tier. |

### `/predictions` — Tahminler / Predictions

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| 2026 Fikstür ve Tahmin Merkezi / 2026 Fixture and Prediction Center | Aktif 2026 sezonundaki tüm maçları, geçmiş skorları ve yayımlanmış/yayımlanmamış tahmin durumunu gösterir. | Shows all active 2026-season fixtures, historical scores and published/unpublished prediction status. |
| Önerilen Tahminler / Recommended Predictions | Yalnız kalite politikasını geçen canlı önerileri listeler. | Lists only live recommendations that pass the quality policy. |
| Tüm Maçlar / All Matches | Önerilmeyen maçları da kehribar renkli danışma tahmini ve kesin ret nedenleriyle gösterir. | Also shows filtered matches with amber advisory estimates and exact rejection reasons. |
| Tarih ve lig filtreleri / Date and league filters | Gün, lig, ev/deplasman, güven ve olasılık eşiğine göre listeyi daraltır. | Narrows the list by day, league, home/away, confidence and probability threshold. |
| Maç satırı / Match row | Takımlar, saat, lig, 1X2 olasılıkları, en iyi tahmin, güven ve sonuç durumunu tek satırda gösterir. | Shows teams, time, league, 1X2 probabilities, top pick, confidence and settlement in one row. |
| Maç Analizi / Match Analysis | Satır açıldığında xG, popüler/güvenli piyasalar, takım karşılaştırması, model bilgileri ve uyarıları gösterir. | When expanded, shows xG, popular/safe markets, team comparison, model information and warnings. |

### `/smart-picks` — Akıllı Tahminler / Smart Picks

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Doğrulanmış Başarı Oranı / Validated Hit Rate | Kronolojik ayrılmış test örneklemindeki başarı oranını gösterir; canlı sezon verisi değildir. | Shows hit rate on the chronological holdout sample; it is not live-season data. |
| Doğrulanmış Tahminler / Validated Picks | Sonuçlandırılmış test tahmini adedini gösterir. | Shows the number of settled validation picks. |
| %90+ Model Tahminleri / 90%+ Model Picks | Model olasılığı %90 ve üzeri tahminlerin sayısını ve başarısını verir. | Gives count and hit rate for picks at 90%+ model probability. |
| Güvenilirlik Performansı / Reliability Performance | Başarı oranını güvenilirlik seviyelerine göre ayırır. | Splits hit rate by reliability tier. |
| Model Olasılığı / Model Probability | Tahminleri olasılık bantlarına ayırıp gerçekleşen başarıyı gösterir. | Groups picks into probability bands and shows actual hit rate. |
| Doğrulama Özeti / Validation Summary | Kazandı, kaybetti ve doğruluktan hariç tutulan geçersiz tahmin sayılarını verir. | Gives Won, Lost and Void counts, with Void excluded from accuracy. |
| Lig Performansı / League Performance | Lig bazında tahmin sayısı, ortalama güvenilirlik ve başarı oranını gösterir. | Shows picks, average reliability and hit rate by league. |
| En İyi Bahis Türleri / Top Markets | En başarılı piyasa–seçim çiftlerini sıralar. | Ranks the strongest market–selection pairs. |
| Doğrulanmış Tahmin Geçmişi / Validated Pick History | Görülmemiş test maçlarının tahmin, skor ve sonuç kayıtlarını listeler. | Lists prediction, score and result records from unseen validation matches. |

### `/evaluation` — Model Performansı / Model Performance

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Arşivlenmiş Tahminler / Archived Picks | Maç öncesi değiştirilemez biçimde kaydedilmiş tahminlerin toplamıdır. | Total predictions immutably stored before kickoff. |
| Genel Doğruluk / Overall Accuracy | Geçersiz tahminler hariç, kazananların kazanan+kaybeden toplamına oranıdır. | Won divided by Won+Lost; Void picks are excluded. |
| Yüksek Güvenilirlik / High Reliability | Yüksek güvenilirlikli arşiv tahminlerinin başarı oranını verir. | Hit rate of high-reliability archived picks. |
| Ortalama Olasılık / Average Probability | Arşivlenen model olasılıklarının ortalamasıdır. | Average of archived model probabilities. |
| Bahis Türüne Göre Performans / Performance by Market | Her bahis türünün sonuçlanan adet ve doğruluk oranını karşılaştırır. | Compares settled count and accuracy for each market. |
| Güvenilirliğe Göre Performans / Performance by Reliability | Yüksek, orta ve düşük güvenilirlik seviyelerinin gerçekleşen başarısını gösterir. | Shows actual performance of high, medium and low reliability tiers. |
| Olasılık Aralıkları / Probability Ranges | Model olasılığı ile gerçekleşen oran arasındaki kalibrasyon farkını verir. | Shows calibration gap between model probability and actual rate. |
| Sonuçlanmış Tahminler / Settled Prediction Results | Her maçı tek satırda özetler; “Detayları göster” ile o maça ait tüm piyasa tahminleri açılır. | Summarizes each match in one row; “Show details” expands every market pick for that match. |

### `/fixtures` — Fikstürler / Fixtures

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Fikstür özeti / Fixture summary | Veritabanındaki gerçek 2026 maçlarının gösterilen adedini ve aktif organizasyonu bildirir. | Reports displayed real 2026 database fixtures and active competition. |
| Fikstür listesi / Fixture list | Maçları kronolojik olarak tarih, saat, tur, takımlar, durum ve skorla listeler. | Lists matches chronologically with date, time, round, teams, status and score. |

### `/teams` — Takımlar / Teams

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Takımlar / Teams | Seçilen organizasyondaki takım sayısını verir. | Gives team count in the selected competition. |
| Maçlar / Matches | Hesaba katılan tamamlanmış maç sayısını gösterir. | Shows completed matches used in calculations. |
| Goller / Goals | Bu maçlardaki toplam gol sayısıdır. | Total goals in those matches. |
| Maç Başına Gol / Goals per Match | Tamamlanan maçlardaki ortalama toplam golü verir. | Average total goals per completed match. |
| Lider / Leader | Güncel puan liderini ve puanını gösterir. | Shows current points leader and points. |
| Takım Performansı / Team Performance | Puan durumu, galibiyet/beraberlik/mağlubiyet, gol, averaj ve maç başına puanı listeler. | Lists standings, W/D/L, goals, goal difference and points per match. |

### `/players` — Oyuncular / Players

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Organizasyon seç / Select organization | Oyuncu verisinin inceleneceği ligi veya Avrupa kupasını seçtirir. | Selects the league or European competition to inspect. |
| Takım seç / Select team | Seçilen organizasyondaki 2026 fikstür takımlarını listeler. | Lists 2026 fixture teams in the selected competition. |
| Seçili takım özeti / Selected team summary | Aktif kadro büyüklüğü, yaş ortalaması, piyasa değeri kaydı, defans ve forvet sayılarını gösterir. | Shows active squad size, average age, market-value coverage, defender and forward counts. |
| Pozisyon filtresi / Position filter | Kadroyu kaleci, defans, orta saha, forvet veya bilinmeyen olarak filtreler. | Filters squad by goalkeeper, defender, midfielder, forward or unknown. |
| Oyuncu listesi / Player list | Oyuncu adı, takım, pozisyon, yaş, forma numarası ve piyasa değerini gösterir. | Shows player, team, position, age, shirt number and market value. |

### `/admin` — Yönetim Paneli / Admin Panel

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Tüm sistemi çalıştır / Run the entire system | Fikstür kontrolü, özellik üretimi ve tahmin yenileme iş akışının giriş noktasıdır. | Entry point for fixture checking, feature generation and prediction refresh. |
| Veri seçimi / Data Selection | Lig, aktif sezon ve çalışma modunu gösterir. | Shows league, active season and runtime mode. |
| Sistem durumu / System Status | PostgreSQL, Prisma, API-Football ve tahmin motoru bağlantılarını bildirir. | Reports PostgreSQL, Prisma, API-Football and prediction-engine connections. |
| İşlem aşamaları / Process Stages | Lig/sezon, takım, fikstür, özellik ve tahmin aşamalarının hazır/kontrol durumunu gösterir. | Shows readiness/check state of league, team, fixture, feature and prediction stages. |

### `/admin/members` — Üye Yönetimi / Member Management

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Yeni üye oluştur / Create New Member | Yönetici onaylı kullanıcı hesabı, geçici şifre, paket ve bitiş tarihi oluşturur. | Creates an admin-approved user, temporary password, plan and expiry date. |
| Paket fiyatları / Plan Prices | Temel, Analiz ve Profesyonel paketlerin TL/EUR aylık fiyatlarını yayımlar; sıfır değer yayımlanmamış demektir. | Publishes TRY/EUR monthly prices; zero means not published. |
| Yükseltme talepleri / Upgrade Requests | Üyelerin paket taleplerini iletişim, ödeme onayı veya ret durumuyla yönetir. | Manages plan requests as Contacted, payment-approved or Rejected. |
| Üyeler / Members | Üye paketini, durumunu, bitiş tarihini, şifresini ve açık oturumlarını yönetir. | Manages plan, status, expiry, password and active sessions. |

### `/settings` — Ayarlar / Settings

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Lig / League | Yönetim bağlamındaki seçili ligi gösterir. | Shows the selected league in the admin context. |
| Sezon / Season | Canlı sayfaların kullandığı aktif 2026 sezonunu gösterir. | Shows the active 2026 season used by live pages. |
| Minimum tahmin olasılığı / Minimum Prediction Probability | Arayüzdeki minimum tahmin eşiğini ayarlar. | Sets the minimum prediction threshold used by the interface. |

### `/operations` — Üretim Operasyon Merkezi / Production Operations Center

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Üretim Özeti / Production Summary | Son yedek, günlük rapor, haftalık ROI ve veri durumunu özetler. | Summarizes latest backup, daily report, weekly ROI and data state. |
| 2026 Veri Kapsamı ve API Kotası / 2026 Data Coverage and API Quota | API planı/kotası, lig, fikstür, skor ve yayımlanmış aday kapsamını gösterir. | Shows API plan/quota, league, fixture, score and published-candidate coverage. |
| Sonuç Uzlaştırma ve Skor Uyarıları / Result Reconciliation and Score Alerts | Eksik skor, bekleyen sonuçlandırma, arşiv uyuşmazlığı ve gecikmiş durumu denetler. | Audits missing scores, pending settlements, archive mismatches and overdue statuses. |
| Üretim Kilitleri / Production Locks | Champion ağırlığının ve otomatik/uzak aktivasyonun kilitli olduğunu doğrular. | Confirms Champion weight and automatic/remote activation remain locked. |
| Model Sağlığı Olayları / Model Health Events | Son sağlık olaylarının seviye, neden ve örneklem bilgisini listeler. | Lists recent health-event level, reason and sample information. |
| Bildirim Kuyruğu / Notification Queue | Yerel bildirimlerin bekliyor/teslim edildi/başarısız durumlarını gösterir. | Shows local notifications as waiting/delivered/failed. |
| Gizlilik Sınırı / Privacy Boundary | Ekranın yalnız özet metadata okuduğunu ve gizli bilgileri açmadığını belirtir. | States that only summary metadata is read and secrets are never exposed. |

### `/value-bets` — Değerli Bahisler / Value Bets

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Ana Öneriler / Main Recommendations | Her maçtan en güçlü bağımsız seçimi ve günlük toplam riski gösterir. | Shows the strongest independent selection per match and daily total risk. |
| İzleme Listesi / Watch List | Pozitif sinyali olsa da portföy eşiğinin altında kalan, bahis miktarı atanmayan adayları gösterir. | Shows positive-signal candidates below portfolio threshold, with no stake. |
| Alternatif Seçimler / Alternative Selections | Aynı maçtaki ikincil piyasaları ek portföy riski oluşturmadan gösterir. | Shows secondary markets for the same match without extra portfolio exposure. |
| Yapay Zekâ Maç Açıklamaları / AI Match Explanations | Model-piyasa farkı, adil/en iyi oran, beklenen kâr, kapsam ve portföy kararını açıklar. | Explains model-market gap, fair/best odds, expected profit, coverage and portfolio decision. |
| Değerli Bahis Doğruluk Paneli / Value Bet Accuracy Dashboard | Sonuçlanan bahis, isabet, kâr birimi, sabit birim ROI ve kırılımları gösterir. | Shows settled bets, hit rate, profit units, flat-stake ROI and breakdowns. |
| Tarihsel Öğrenme ve Ağırlık Optimizasyonu / Historical Learning and Weight Optimizer | 300 bağımsız sonuç eşiğini, kronolojik eğitim/doğrulama sonuçlarını ve aday ağırlığı izler; otomatik değiştirmez. | Tracks the 300-result threshold, chronological train/validation and candidate weight; never auto-activates. |
| Lig Profil Motoru / League Profile Engine | Lig bazında isabet, ROI, kalibrasyon, Brier ve güvenilirlik durumunu karşılaştırır. | Compares hit rate, ROI, calibration, Brier and reliability by league. |
| Champion–Challenger Denetimi / Champion–Challenger Audit | Kilitli Champion ile kalibre edilmiş Challenger’ı son görülmemiş dönemde karşılaştırır. | Compares locked Champion and calibrated Challenger on the final unseen period. |
| Model Sağlığı ve Sapma İzleyicisi / Model Health and Drift Monitor | Veri tazeliği, bahis şirketi gecikmesi, Brier/ECE/olasılık/doğruluk sapmasını izler. | Monitors freshness, bookmaker lag and Brier/ECE/probability/accuracy drift. |
| Değerli Bahis Geçmişi / Value Bet History | Maç öncesi sabitlenmiş oran, olasılık, portföy kararı ve sonuç kayıtlarını gösterir. | Shows immutable pre-kickoff odds, probability, portfolio decision and result history. |

## Üye sayfaları / Member pages

### `/member` — Bugünün Tahminleri / Today's Predictions

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Bugünün Tahminleri / Today's Predictions | Üyenin paketine göre bugün yayımlanan maç, seçim ve güven bilgisini gösterir. | Shows today's published match, selection and confidence according to plan. |
| Analiz Ayrıntıları / Analysis Details | Analiz ve Profesyonel üyeye 1X2 olasılıklarını gösterir. | Shows 1X2 probabilities to Analysis and Professional members. |
| Profesyonel Ayrıntılar / Professional Details | Yalnız Profesyonel üyeye xG, veri kalitesi ve adil oranı gösterir. | Shows xG, data quality and fair odds only to Professional members. |
| Son 30 Gün / Last 30 Days | Analiz ve Profesyonel üyeye geçmiş tahmin, skor ve sonuçları gösterir. | Shows past picks, scores and results to Analysis and Professional members. |
| Üyelik Kapsamınız / Your Membership Access | Açık özellikleri ve üst paket gerektiren alanları özetler. | Summarizes available features and areas requiring a higher plan. |

### `/member/plans` — Paket Karşılaştırma / Plan Comparison

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Temel / Basic | Yalnız bugünün yayımlanmış tahminlerini ve sade günlük ekranı içerir. | Includes today's published predictions and the simple daily screen. |
| Analiz / Analysis | Temel kapsamına ek olarak 1X2 olasılıkları ve son 30 günlük sonuç geçmişini içerir. | Adds 1X2 probabilities and 30-day result history to Basic. |
| Profesyonel / Professional | Analiz kapsamına ek olarak xG, veri kalitesi, adil oran ve profesyonel ayrıntıları içerir. | Adds xG, data quality, fair odds and professional details to Analysis. |
| Yükseltme Talebi / Upgrade Request | Ödeme yapmadan yalnız yöneticiye inceleme talebi gönderir; paket otomatik açılmaz. | Sends a review request to the administrator without payment; plan is not auto-activated. |

### `/login` — Üye Girişi / Member Login

| Kutu / Panel | Türkçe açıklama | English description |
|---|---|---|
| Üye Girişi / Member Login | Yönetici tarafından oluşturulmuş e-posta ve şifreyle güvenli oturum açar. Açık kayıt yoktur. | Signs in securely with admin-created email and password. Public registration is disabled. |

## Erişim özeti / Access summary

| Rol / Role | Erişim / Access |
|---|---|
| Yönetici / Administrator | Tüm yönetim, analiz, operasyon ve üyelik sayfaları. / All admin, analytics, operations and membership pages. |
| Temel / Basic | Yalnız bugünün yayımlanmış tahminleri. / Today's published predictions only. |
| Analiz / Analysis | Temel + 1X2 olasılıkları + son 30 günlük geçmiş/sonuç. / Basic + 1X2 probabilities + 30-day history/results. |
| Profesyonel / Professional | Analiz + xG + veri kalitesi + adil oran. / Analysis + xG + data quality + fair odds. |

> Tahminler olasılık analizidir; kesin sonuç veya kâr garantisi değildir. / Predictions are probability analyses, not guarantees of outcomes or profit.
