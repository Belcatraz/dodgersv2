@echo off
set PATH=C:\Program Files\nodejs;C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;%PATH%
cd /d "C:\Users\User\AI Projects\Antigravity Projects\dodgersv2"
echo === Installing dependencies ===
call npm install --include=dev
if %ERRORLEVEL% NEQ 0 (
    echo FAILED: npm install
    pause
    exit /b 1
)
echo === Building production bundle ===
call npx vite build
if %ERRORLEVEL% NEQ 0 (
    echo FAILED: vite build
    pause
    exit /b 1
)
echo.
echo === BUILD SUCCESSFUL ===
echo The dist folder is ready for deploy.
echo.
pause
