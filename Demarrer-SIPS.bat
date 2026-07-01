@echo off
title Serveur SIPS - Hunter's Food
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
  echo ============================================
  echo   Le serveur SIPS est deja lance.
  echo ============================================
  echo.
  echo   Adresse PC      : http://localhost:3000
  for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo   Adresse reseau :http://%%a:3000
  echo.
  echo   Ne lance pas une deuxieme fenetre serveur.
  echo   Si tu veux redemarrer, ferme d'abord l'ancienne fenetre serveur.
  echo ============================================
  echo.
  pause
  exit /b
)
echo ============================================
echo   Demarrage du serveur SIPS...
echo ============================================
echo.
echo   Adresse PC      : http://localhost:3000
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo   Adresse reseau :http://%%a:3000
echo.
echo   Laisse cette fenetre OUVERTE pendant l'utilisation.
echo   Ferme-la pour arreter le serveur.
echo ============================================
echo.
node server/app.mjs
echo.
echo Le serveur s'est arrete. Appuie sur une touche pour fermer.
pause >nul
