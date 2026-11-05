# CASEFILE — Professional onboarding and Google sign-in

This upgrade refreshes the existing CASEFILE sign-in / registration experience and adds a real Google Identity Services sign-in path. The investigation workspace and existing case workflow are preserved.

## Files in this upgrade

Replace these existing files:

- `client/src/App.jsx`
- `client/src/App.css`
- `client/src/services/api.js`
- `client/index.html`
- `server/models/User.js`
- `server/controllers/authController.js`
- `server/routes/authRoutes.js`
- `server/server.js`

Create these new files:

- `client/src/components/GoogleSignInButton.jsx`
- `server/controllers/googleAuthController.js`

## 1. Back up the project

Make a copy of the complete `AI Mystery Room` folder before replacing files. Do not replace either `.env` file with an example file.

## 2. Install Google token verification on the backend

From PowerShell:

```powershell
cd "C:\Users\sujay\OneDrive\Desktop\Full Stack Projects\AI Mystery Room\server"
npm install google-auth-library
```

This command adds the package to `server/package.json` and updates `server/package-lock.json`. Keep the existing `overrides` section for `minimatch` in the package manifest.

## 3. Create a Google OAuth Web Client ID

1. Open Google Cloud Console: https://console.cloud.google.com/
2. Create or select a Cloud project.
3. Open Google Auth Platform and configure the app branding / consent screen. Use `CASEFILE` as the app name and enter a support email you control.
4. For initial testing, configure the audience as External and add your own Google account as a test user if Google presents the testing-user step.
5. Open Clients and create an OAuth client with application type **Web application**.
6. Under Authorized JavaScript origins, add:
   - `http://localhost`
   - `http://localhost:5173`
7. When the production frontend is deployed, add its exact HTTPS origin as another authorized JavaScript origin.
8. The JavaScript callback integration in this project does not require an Authorized redirect URI.
9. The default `openid`, `email`, and `profile` identity scopes are sufficient. Do not request extra Google API scopes for this sign-in feature.

Copy the **Web Client ID**. Do not put a Google client secret in the React app. This ID-token flow does not require a client secret in the browser.

Official Google setup and verification guides:
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

## 4. Configure the same Client ID in both apps

Add this line to the existing `server/.env` file, preserving all existing settings:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Create `client/.env.local` with:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:5000/api
```

Use the exact same Web Client ID in both places. `VITE_GOOGLE_CLIENT_ID` is intentionally public because it is embedded in the frontend; never place `GEMINI_API_KEY`, `MONGODB_URI`, `JWT_SECRET`, or a Google client secret in any `VITE_` variable.

The repository's `.gitignore` already ignores `.env` and `.env.*`; keep that protection in place.

## 5. Start the apps

Restart both terminals after adding environment variables.

Backend:

```powershell
cd "C:\Users\sujay\OneDrive\Desktop\Full Stack Projects\AI Mystery Room\server"
npm run dev
```

Frontend:

```powershell
cd "C:\Users\sujay\OneDrive\Desktop\Full Stack Projects\AI Mystery Room\client"
npm run dev
```

Then open `http://localhost:5173`, sign out of CASEFILE, and check the new access screen. When the Client ID is configured, the Google button is rendered by Google's official Identity Services library. If the Client ID is not configured, the UI shows a setup notice rather than a fake, nonfunctional sign-in button.

## 6. What Google sign-in does

- Google Identity Services returns an ID token to the React callback.
- React sends that credential to `POST /api/auth/google`.
- The backend verifies the signed token, audience, issuer, expiry, subject, and verified email using `google-auth-library`.
- Only Gmail addresses or verified Google Workspace addresses are automatically accepted for account linking.
- CASEFILE then issues its own 7-day JWT, and existing case ownership checks continue to apply.
- If the Google email matches an existing CASEFILE email/password account, the Google subject is linked to that account. If the address is already linked to a different Google subject, sign-in is rejected rather than merging accounts.

Existing local email/password accounts and their cases are not replaced. The updated User model allows a Google-only account to have no password hash; normal email/password accounts still use bcrypt hashes.

## 7. Verify before deployment

1. `npm audit` from both `server` and `client`.
2. `npm run lint` from `client`.
3. `npm run build` from `client`.
4. Sign in using the existing email/password account and confirm its case history remains available.
5. Sign out and test Google sign-in using an account added as an OAuth test user.
6. If the Google account uses the same verified email as an existing CASEFILE account, confirm it opens that same account's cases.
7. Verify the second account still cannot retrieve the first account's case IDs.
8. After deployment, add the deployed frontend HTTPS origin to Google Authorized JavaScript origins and update `CLIENT_URL` / `VITE_API_BASE_URL` for the production services.

Google OAuth setup is not complete until the Client ID is configured in Cloud Console and in the two environment files. The app code includes the integration, but the actual provider flow must still be tested with your own Google project.
