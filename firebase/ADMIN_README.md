Admin SDK initialization & grant workflow

Files added:
- `src/admin.ts` - ESM/TypeScript helper to initialize the Firebase Admin SDK and export helpers.
- `scripts/set-claim.cjs` - CommonJS CLI script that sets/unsets the `admin` custom claim.

Quick usage

1) Set service account path in env (recommended):

PowerShell:

$env:SERVICE_ACCOUNT_PATH = 'C:\path\to\serviceAccountKey.json'
node .\scripts\set-claim.cjs <UID> --admin=true
Remove-Item Env:\SERVICE_ACCOUNT_PATH

Or use the ESM helper in server code (TypeScript):

import { initAdmin, getAdminAuth, getAdminFirestore } from './src/admin';

// either set SERVICE_ACCOUNT_PATH or SERVICE_ACCOUNT_JSON_BASE64 in environment, or pass path:
initAdmin({ serviceAccountPath: 'C:/path/to/serviceAccountKey.json' });
const auth = getAdminAuth();
const db = getAdminFirestore();

Granting/Revoking

- Grant admin: node ./scripts/set-claim.cjs <UID> --admin=true --key="C:\path\to\key.json"
- Revoke admin: node ./scripts/set-claim.cjs <UID> --admin=false --key="C:\path\to\key.json"

Token refresh (client)

After changing claims, the user must refresh their ID token to see the new claims:

await auth.currentUser.getIdToken(true);
const tr = await auth.currentUser.getIdTokenResult();
console.log(tr.claims);

Security notes

- Never commit service account JSON to git.
- Prefer env-based provisioning (SERVICE_ACCOUNT_PATH or SERVICE_ACCOUNT_JSON_BASE64) over placing the key in the repo.
- Only grant admin claims after manual review or through a protected admin UI / Cloud Function.
