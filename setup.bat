@echo off
echo Installing dependencies...
cd server && npm install
cd ../client && npm install
cd ..
echo.
echo Done! Now:
echo  1. Make sure MongoDB is running locally
echo  2. Run: cd server ^&^& npm run dev
echo  3. In another terminal: cd client ^&^& npm run dev
echo  4. Open http://localhost:5173
