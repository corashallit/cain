@echo off
setlocal
REM Double-click this file to run the CAIN talisman board through a small local
REM web server. Serving it (instead of opening the .html directly) lets the page
REM read the reference\ folders live -- drop new images into reference\details or
REM reference\backgrounds, then just refresh the page to see them.
REM
REM Leave this window open while you use the board. Close it (or press Ctrl-C)
REM to stop the server.

cd /d "%~dp0"
set PORT=8137
set URL=http://localhost:%PORT%/talismans.html

REM Prefer the "py" launcher (python.org installs); a bare "python" on PATH may
REM be the Microsoft Store stub, which opens the Store instead of running.
set PYCMD=
where py >nul 2>nul && set PYCMD=py -3
if not defined PYCMD (
    where python >nul 2>nul && set PYCMD=python
)
if not defined PYCMD (
    echo Python 3 is required but could not be found on this PC.
    echo Install it from https://www.python.org/downloads/ then re-run this file.
    pause
    exit /b 1
)

echo Serving CAIN talismans at:
echo     %URL%
echo.
echo Add art to reference\details or reference\backgrounds, then refresh the page.
echo Close this window ^(or press Ctrl-C^) to stop the server.
echo.

REM open the page once the server has had a moment to start
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 1; Start-Process '%URL%'"

%PYCMD% -m http.server %PORT%
