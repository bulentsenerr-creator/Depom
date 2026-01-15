# Kitap Kütüphanem — v3.1 (Dinamik Raflar + Gerçek Zamanlı Filtre)

## Yeni isteklerin uygulandı
### ✅ Dinamik raf mantığı
- Formlarda **Raf** alanı var.
- Raf adını sen yazıyorsun → raf otomatik oluşuyor.
- Kitap kaydedilince o rafa düşüyor.
- Raf adı değiştirip kaydedince kitap otomatik olarak yeni rafa geçiyor.

### ✅ Gerçek zamanlı filtreleme
- Filtre/Sıralama ekranında **Apply/Uygula yok**.
- Alanları değiştirince liste **anında** güncellenir (debounce ile).

Not: Barkod/kamera sistemi korunmuştur.

Çalıştırma:
```bash
python -m http.server 8080
```

Oluşturulma: 2026-01-15 12:49 UTC
