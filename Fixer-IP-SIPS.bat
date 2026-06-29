@echo off
title Fixer l'adresse IP du PC pour SIPS
:: --- Auto-elevation en administrateur ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Demande des droits administrateur...
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)
echo ============================================
echo   Attribution de l'IP fixe 192.168.1.240
echo ============================================
echo.
netsh interface ip set address name="Wi-Fi" static 192.168.1.240 255.255.255.0 192.168.1.1
netsh interface ip set dns name="Wi-Fi" static 192.168.1.1
echo.
echo --- Verification ---
timeout /t 3 >nul
ipconfig | findstr /c:"IPv4"
echo.
echo Si tu vois 192.168.1.240 ci-dessus, c'est bon.
echo Pour revenir au mode automatique plus tard :
echo   netsh interface ip set address name="Wi-Fi" dhcp
echo   netsh interface ip set dns name="Wi-Fi" dhcp
echo.
pause
