import * as THREE from 'three';
import * as TWEEN from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { tableLayout, sphereLayout, helixLayout, gridLayout } from './layouts.js';

const CFG = window.APP_CONFIG || {};
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly openid profile email';
const TOKEN_KEY = 'pt_token';

const $ = (id) => document.getElementById(id);
const loginEl = $('login');
const appEl = $('app');
const signinBtn = $('signin');
const loginError = $('login-error');
const statusEl = $('status');

// ------------------------------------------------------------------ helpers
function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.hidden = !msg;
}

function setStatus(msg) {
  statusEl.textContent = msg || '';
  statusEl.hidden = !msg;
}

function configured() {
  return CFG.GOOGLE_CLIENT_ID && !CFG.GOOGLE_CLIENT_ID.startsWith('YOUR_') &&
         CFG.SHEET_ID && !CFG.SHEET_ID.startsWith('YOUR_');
}

class AuthError extends Error {}

function saveToken(token, expiresIn) {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + (expiresIn - 60) * 1000 }));
  } catch (e) { /* storage unavailable: user simply signs in again on reload */ }
}

function loadToken() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    if (saved && saved.exp > Date.now()) return saved.token;
  } catch (e) { /* ignore */ }
  return null;
}

function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------------ Google auth
let tokenClient = null;

function waitForGoogle(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.google && google.accounts && google.accounts.oauth2) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Google Sign-In failed to load. Check your connection and reload.'));
      }
    }, 100);
  });
}

async function initAuth() {
  if (!configured()) {
    showLoginError('Setup needed: add your Google client ID and Sheet ID to config.js.');
    return;
  }
  try {
    await waitForGoogle();
  } catch (e) {
    showLoginError(e.message);
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CFG.GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        showLoginError('Sign-in failed: ' + (resp.error_description || resp.error));
        return;
      }
      saveToken(resp.access_token, Number(resp.expires_in) || 3600);
      startApp(resp.access_token);
    },
    error_callback: (err) => {
      // Fired when the popup is closed or blocked.
      showLoginError(err && err.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Sign-in failed. Allow pop-ups and try again.');
    }
  });
  signinBtn.disabled = false;
}

signinBtn.addEventListener('click', () => {
  showLoginError('');
  if (tokenClient) tokenClient.requestAccessToken({ prompt: 'select_account' });
});

$('signout').addEventListener('click', () => {
  const token = loadToken();
  clearToken();
  if (token && window.google && google.accounts && google.accounts.oauth2) {
    google.accounts.oauth2.revoke(token, () => location.reload());
  } else {
    location.reload();
  }
});

// ------------------------------------------------------------------ data
async function fetchUser(token) {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (r.ok) return await r.json();
  } catch (e) { /* non-fatal */ }
  return null;
}

async function fetchSheet(token) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(CFG.SHEET_ID) +
              '/values/' + encodeURIComponent(CFG.SHEET_RANGE || 'A:F');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 401) throw new AuthError('Your session expired. Please sign in again.');
  if (r.status === 403) throw new Error('This Google account cannot read the Sheet. Share the Sheet with the account you signed in with.');
  if (r.status === 404) throw new Error('Sheet not found. Check SHEET_ID in config.js.');
  if (!r.ok) throw new Error('Could not load the Sheet (HTTP ' + r.status + ').');
  const json = await r.json();
  return parseRows(json.values || []);
}

function parseMoney(v) {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function tierOf(netWorth) {
  if (netWorth < 100000) return 'red';
  if (netWorth > 200000) return 'green';
  return 'orange';
}

function parseRows(values) {
  if (!values.length) return [];
  const head = values[0].map((h) => String(h).trim().toLowerCase());
  const col = (name) => head.indexOf(name);
  const iName = col('name'), iPhoto = col('photo'), iAge = col('age'),
        iCountry = col('country'), iInterest = col('interest'), iNet = col('net worth');
  if ([iName, iPhoto, iAge, iCountry, iInterest, iNet].includes(-1)) {
    throw new Error('Sheet columns must be: Name, Photo, Age, Country, Interest, Net Worth.');
  }
  const people = [];
  for (const row of values.slice(1)) {
    const name = String(row[iName] ?? '').trim();
    if (!name) continue;
    const netWorth = parseMoney(row[iNet]);
    people.push({
      name,
      photo: String(row[iPhoto] ?? '').trim(),
      age: String(row[iAge] ?? '').trim(),
      country: String(row[iCountry] ?? '').trim(),
      interest: String(row[iInterest] ?? '').trim(),
      netWorth,
      tier: tierOf(netWorth)
    });
  }
  return people;
}

// ------------------------------------------------------------------ tiles
function makeTile(p) {
  const el = document.createElement('div');
  el.className = 'tile ' + p.tier;
  el.title = p.name + ' - $' + p.netWorth.toLocaleString('en-US', { maximumFractionDigits: 2 });

  const top = document.createElement('div');
  top.className = 'top';
  const country = document.createElement('span');
  country.textContent = p.country;
  const age = document.createElement('span');
  age.textContent = p.age;
  top.append(country, age);

  const photo = document.createElement('div');
  photo.className = 'photo';
  const initials = p.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  if (/^https?:\/\//i.test(p.photo)) {
    const img = document.createElement('img');
    img.alt = p.name;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { photo.textContent = initials; };
    img.src = p.photo;
    photo.append(img);
  } else {
    photo.textContent = initials;
  }

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = p.name;

  const interest = document.createElement('div');
  interest.className = 'interest';
  interest.textContent = p.interest;

  el.append(top, photo, name, interest);
  return el;
}

// ------------------------------------------------------------------ 3D scene
let camera, scene, renderer, controls;
let started = false;
const objects = [];
const targets = {};

function toTargets(layout) {
  return layout.map(({ pos, look }) => {
    const o = new THREE.Object3D();
    o.position.set(pos[0], pos[1], pos[2]);
    if (look) o.lookAt(new THREE.Vector3(look[0], look[1], look[2]));
    return o;
  });
}

function initScene(people) {
  const container = $('container');

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 20000);
  camera.position.z = 3400;

  scene = new THREE.Scene();

  for (const p of people) {
    const obj = new CSS3DObject(makeTile(p));
    obj.position.set(Math.random() * 4000 - 2000, Math.random() * 4000 - 2000, Math.random() * 4000 - 2000);
    scene.add(obj);
    objects.push(obj);
  }

  const n = objects.length;
  targets.table = toTargets(tableLayout(n));
  targets.sphere = toTargets(sphereLayout(n));
  targets.helix = toTargets(helixLayout(n));
  targets.grid = toTargets(gridLayout(n));

  renderer = new CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  controls = new TrackballControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.maxDistance = 12000;

  for (const name of ['table', 'sphere', 'helix', 'grid']) {
    $(name).addEventListener('click', () => transform(name, 2000));
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    controls.handleResize();
  });

  transform('table', 2000);
  animate();
}

function transform(name, duration) {
  const list = targets[name];
  document.querySelectorAll('#menu button').forEach((b) => b.classList.toggle('active', b.id === name));

  TWEEN.removeAll();
  objects.forEach((object, i) => {
    const t = list[i];
    new TWEEN.Tween(object.position)
      .to({ x: t.position.x, y: t.position.y, z: t.position.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
    new TWEEN.Tween(object.rotation)
      .to({ x: t.rotation.x, y: t.rotation.y, z: t.rotation.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  });
}

function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------ start
async function startApp(token) {
  if (started) return;
  showLoginError('');
  loginEl.hidden = true;
  appEl.hidden = false;
  setStatus('Loading data from Google Sheets...');

  try {
    const [people, user] = await Promise.all([fetchSheet(token), fetchUser(token)]);
    if (!people.length) throw new Error('The Sheet has no rows.');
    $('username').textContent = user ? (user.name || user.email || '') : '';
    started = true;
    setStatus('');
    initScene(people);
  } catch (e) {
    clearToken();
    appEl.hidden = true;
    loginEl.hidden = false;
    showLoginError(e.message || 'Something went wrong.');
  }
}

(async function main() {
  await initAuth();
  const saved = loadToken();
  if (saved && configured()) startApp(saved);
})();
