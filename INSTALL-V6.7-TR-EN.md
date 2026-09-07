# V6.7 — Tam Site TR/EN Tutarlılığı ve Sayfa Rehberi

Bu güncelleme veritabanı şemasını, üyeleri, paket fiyatlarını, tahmin verilerini veya model ağırlığını değiştirmez.

## Yapılanlar

- Giriş, üye, paket, yönetici, operasyon, tahmin, değerlendirme ve Value Bet ekranlarındaki TR/EN karışıklıkları giderildi.
- Dinamik sayaçlar, kullanıcı selamlaması, form mesajları, placeholder, title ve aria-label alanları dil değişimine dahil edildi.
- Değerlendirme sayfasındaki “Detayları göster / Show details” kontrolü iki dilde standartlaştırıldı.
- Her sayfadaki başlıklı kutuları açıklayan `SITE-BOX-GUIDE-TR-EN.md` eklendi.
- Otomatik dil tutarlılığı testi eklendi.

## Windows PowerShell kurulumu

```powershell
cd C:\Users\FMGammon\Desktop\bet-project

Get-Process node -ErrorAction SilentlyContinue |
  Stop-Process -Force

pnpm run backup:production
pnpm run verify:backup

Expand-Archive `
  "$env:USERPROFILE\Downloads\bet-project-v6.7-full-site-language-page-guide.zip" `
  -DestinationPath . `
  -Force

pnpm run test:language-consistency-v6
pnpm exec tsc --noEmit

Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
pnpm build
pnpm dev
```

Ardından `http://localhost:3000` adresini açın. Sol menüde **TR** ve **EN** arasında geçiş yaparak giriş, üye, yönetici, operasyon, tahmin, değerlendirme ve Value Bet sayfalarını kontrol edin.

## Güvenlik sınırı

- Champion: `%20 ML / %80 Poisson` olarak kalır.
- Otomatik model değişimi: kilitli kalır.
- Paket fiyatları: değiştirilmez.
- Üye hesapları ve oturumlar: değiştirilmez.
- Veritabanı migration işlemi gerekmez.
