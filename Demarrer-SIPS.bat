@echo off
title Serveur SIPS - Hunter's Food
cd /d "%~dp0"
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
