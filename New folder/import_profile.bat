@echo off
chcp 65001 >nul
color 0B
echo ===================================================
echo   SARAÇ APP - KASA CHROME ICE AKTARMA SCRIPT'I
echo ===================================================
echo.
echo Bu script Masaustundeki "KasaChrome_Yedek.zip" dosyasini 
echo C:\KasaChrome klasorune cikarir ve sisteme kurar.
echo.
echo Devam etmek icin klavyeden herhangi bir tusa basin...
pause >nul

echo.
set "KASA_PROFILE=C:\KasaChrome"
set "ZIP_PATH=%USERPROFILE%\Desktop\KasaChrome_Yedek.zip"

if not exist "%ZIP_PATH%" (
    echo.
    echo HATA: Masaustunde KasaChrome_Yedek.zip bulunamadi!
    pause
    exit /b
)

echo [1/3] Chrome kapatiliyor...
taskkill /F /IM chrome.exe /T >nul 2>&1
timeout /t 3 /nobreak >nul

if exist "%KASA_PROFILE%" (
    echo [2/3] Eski C:\KasaChrome klasoru temizleniyor...
    rmdir /S /Q "%KASA_PROFILE%"
)

echo [3/3] ZIP dosyasi cikartiliyor... (Lutfen bekleyin)
:: PowerShell kullanarak ZIP'ten cikarma
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%KASA_PROFILE%' -Force"

echo.
echo ===================================================
echo   ICE AKTARMA BASARIYLA TAMAMLANDI!
echo ===================================================
echo Masaustundeki Kasa Chrome kisayolundan erisebilirsiniz.
echo.
pause
