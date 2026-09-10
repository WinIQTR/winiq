# WinIQ ödeme bağlantıları kurulumu

Ödeme yöntemleri üye paket ekranında yalnız ilgili Netlify değişkeni doluysa görünür.

## 1. Wise (yurt dışı)

1. Wise Business hesabınızda Quick Pay / payment link oluşturun.
2. Oluşan HTTPS bağlantısını kopyalayın.
3. Netlify > Project configuration > Environment variables bölümünde ekleyin:
   - Key: WISE_PAYMENT_URL
   - Value: Wise bağlantınız
4. Production kapsamını seçin ve kaydedin.

## 2. Banka havalesi (Türkiye)

Netlify ortam değişkenlerine şunları ekleyin:

- BANK_TRANSFER_IBAN: Size veya şirketinize ait TL IBAN
- PAYMENT_ACCOUNT_NAME: Banka hesabındaki tam alıcı adı

Üye ekranında IBAN, alıcı, TL tutarı ve kişiye özel ödeme açıklaması gösterilir.

## 3. İninal (Türkiye)

İninal Kurumsal üzerinden Sanal POS / ödeme alma anlaşması yapın. Size verilen
güvenli ödeme sayfası bağlantısını aşağıdaki değişkene ekleyin:

- ININAL_PAYMENT_URL: İninal tarafından verilen HTTPS ödeme bağlantısı

Kişisel İninal kart yükleme IBAN'ını müşteri ödeme bağlantısı olarak kullanmayın.

## 4. Yayınlama

Değişkenleri kaydettikten sonra Netlify > Deploys > Trigger deploy > Deploy site
ile yeni production deployment başlatın.

## 5. İşleyiş

1. Üye paket ekranından yükseltme talebi gönderir.
2. Seçtiği yöntemle ödemeyi yapar ve verilen WINIQ-PAKET-REFERANS açıklamasını kullanır.
3. Yönetici ödeme hareketindeki referansı taleple eşleştirir.
4. Yönetici panelinde Ödemeyi onayla ve yükselt düğmesiyle paketi etkinleştirir.

Bu sürümde üyelik ödeme görülmeden otomatik açılmaz. Bu kontrol, yanlış veya
eşleşmeyen ödemelerde erişim verilmesini önler.
