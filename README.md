# People Table (three.js CSS3D + Google Sheets + Google login)

A reworked version of the three.js `css3d_periodictable` demo. After signing in with Google,
the page reads people from a Google Sheet and shows them as 200 tiles that can be arranged as
a Table (20x10), Sphere, double Helix or Grid (5x4x10). Tile colour comes from Net Worth:
red below $100K, orange from $100K to $200K, green above $200K.

Files: `index.html`, `style.css`, `main.js`, `layouts.js`, `config.js`, `data.csv` (cleaned UTF-8 copy of your CSV).

## 1. Google Sheet
1. Go to sheets.new, then File > Import > Upload, and choose `data.csv`. Pick "Replace spreadsheet".
2. Share the Sheet with `lisa@kasatria.com` (Viewer is enough).
3. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.

Keep the first row as the header: Name, Photo, Age, Country, Interest, Net Worth.

## 2. Google Cloud project (OAuth client)
1. console.cloud.google.com > create a project.
2. APIs & Services > Library > enable **Google Sheets API**.
3. APIs & Services > OAuth consent screen: user type External, fill in app name and your email.
   Add the scope `.../auth/spreadsheets.readonly`. While the app is in **Testing**, add yourself and
   `lisa@kasatria.com` under **Test users**, otherwise they cannot sign in. (Or click Publish app.)
4. APIs & Services > Credentials > Create credentials > **OAuth client ID** > Web application.
   Under **Authorized JavaScript origins** add:
   - `https://<your-github-username>.github.io` (no path, no trailing slash)
   - `http://localhost:8000` (for local testing)
5. Copy the client ID.

## 3. Configure
Edit `config.js`: paste the client ID and the Sheet ID.

## 4. Test locally
In this folder run `py -m http.server 8000` (Windows) and open `http://localhost:8000`.
(Opening index.html by double-click will not work: Google sign-in needs http/https.)

## 5. Host on GitHub Pages
1. Create a public repo and upload all files in this folder.
2. Settings > Pages > Deploy from a branch > `main` / root > Save.
3. Your URL will be `https://<your-github-username>.github.io/<repo-name>/`. Send that link.

## Notes
- Sign-in shows "Google hasn't verified this app" while the app is in Testing: Advanced > Continue.
- The reader must sign in with a Google account that has access to the Sheet, otherwise the page
  shows "This Google account cannot read the Sheet".
- Photos load from the URLs in the Sheet; if one fails, initials are shown instead.
