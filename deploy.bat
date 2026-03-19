@echo off
set PATH=C:\Program Files\nodejs;C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;%PATH%
cd /d "C:\Users\User\AI Projects\Antigravity Projects\dodgersv2"
echo Installing dependencies...
call npm install --include=dev
echo Building...
call npx vite build
echo Deploying to Netlify...
call npx netlify-cli deploy --prod --dir=dist --site=608ca428-bac9-49ea-ae93-075377815883
echo Done!
pause
