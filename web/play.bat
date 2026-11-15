@echo off
rem Serve the production build over http so the game can load its GLB/texture assets.
rem Usage: play.bat            -> serves dist\ on http://127.0.0.1:8080
rem        play.bat dist-single -> serves the single-file build folder instead
cd /d "%~dp0"
set "DIR=%~1"
if "%DIR%"=="" set "DIR=dist"
if not exist "%DIR%\index.html" if not exist "%DIR%\aetheria.html" (
  echo %DIR%\ not found. Build first: npm install and npm run build
  pause
  exit /b 1
)
echo Open http://127.0.0.1:8080/?quality=medium  (Ctrl+C to stop)
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8080 --bind 127.0.0.1 --directory "%DIR%"
) else (
  npx --yes serve "%DIR%" -l 8080
)
