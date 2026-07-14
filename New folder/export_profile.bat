@echo off
chcp 65001 >nul
color 0B
echo ===================================================
echo   SARAÇ APP - KASA CHROME DISA AKTARMA SCRIPT'I
echo ===================================================
echo.
echo Bu script C:\KasaChrome profilini Masaustune ZIP olarak yedekler.
echo NOT: Windows guvenligi (DPAPI) geregi baska bir bilgisayara
echo aktardiginizda cerezler ve kayitli sifreler SIFIRLANACAKTIR!
echo Sadece gecmis, yer imleri ve eklentiler aktarilir.
echo.
echo Devam etmek icin klavyeden herhangi bir tusa basin...
pause >nul

echo.
echo [1/2] Chrome kapatiliyor...
taskkill /F /IM chrome.exe /T >nul 2>&1
timeout /t 3 /nobreak >nul

set "KASA_PROFILE=C:\KasaChrome"
set "ZIP_PATH=%USERPROFILE%\Desktop\KasaChrome_Yedek.zip"

if not exist "%KASA_PROFILE%" (
    echo.
    echo HATA: C:\KasaChrome klasoru bulunamadi!
    pause
    exit /b
)

if exist "%ZIP_PATH%" del /F /Q "%ZIP_PATH%"

echo [2/2] Profil ZIP dosyasina sikistiriliyor... (Lutfen bekleyin)
:: PowerShell kullanarak ZIP'leme islemi
powershell -NoProfile -Command "Compress-Archive -Path '%KASA_PROFILE%\*' -DestinationPath '%ZIP_PATH%' -Force"

echo.
echo ===================================================
echo   ISLEM TAMAMLANDI!
echo ===================================================
echo Masaustunuzde "KasaChrome_Yedek.zip" adinda bir dosya olusturuldu.
echo Bu dosyayi flash bellek ile diger bilgisayara tasiyabilirsiniz.
echo.
pause
