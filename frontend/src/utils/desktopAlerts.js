/**
 * @file desktopAlerts.js
 * Browser (system) notifications for new alerts while the app is open in a background tab.
 * Opt-in per browser: the person turns it on from the bell menu, which asks for permission.
 * Urgent kinds (alerts, deteriorating patients) stay on screen until dismissed and play a short tone.
 */

const PREF_KEY = 'mediorchestra_desktop_alerts';
const CLAIM_KEY = 'mediorchestra_alerted_ids';
export const URGENT_TYPES = ['alert', 'patient_critical'];

export const isSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/** 'unsupported' | 'default' | 'granted' | 'denied' */
export const permission = () => (isSupported() ? window.Notification.permission : 'unsupported');

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) === 'on';
  } catch {
    return false;
  }
}

function writePref(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: preference lasts for this page only */
  }
}

/** Desktop alerts are on when the person opted in and the browser allows it. */
export const isEnabled = () => permission() === 'granted' && readPref();

/** Turn on (asks the browser for permission if needed). Resolves to the resulting enabled state. */
export async function enable() {
  if (!isSupported()) return false;
  let p = window.Notification.permission;
  if (p === 'default') p = await window.Notification.requestPermission();
  writePref(p === 'granted');
  return p === 'granted';
}

export function disable() {
  writePref(false);
}

/**
 * Claim a notification id so it is announced once, even with the same role open in several tabs.
 * Returns false when another tab already announced it.
 */
export function claim(id) {
  try {
    const ids = JSON.parse(localStorage.getItem(CLAIM_KEY) || '[]');
    if (ids.includes(id)) return false;
    localStorage.setItem(CLAIM_KEY, JSON.stringify([...ids, id].slice(-200)));
  } catch {
    /* storage unavailable: announce anyway */
  }
  return true;
}

let audio = null;

/** Short two-tone chime (no audio file). Silently does nothing if the browser blocks audio. */
export function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.18, t + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.17);
    });
  } catch {
    /* audio not available */
  }
}

/**
 * Show one system notification. `onOpen` runs when it is clicked (after focusing the tab).
 * @returns {Notification|null}
 */
export function showDesktop(n, onOpen) {
  if (!isEnabled()) return null;
  try {
    const urgent = URGENT_TYPES.includes(n.type);
    const note = new window.Notification(n.title || 'MediOrchestra', {
      body: n.message || '',
      tag: String(n.id), // the OS replaces rather than duplicates the same notification
      icon: '/favicon.svg',
      requireInteraction: urgent,
    });
    note.onclick = () => {
      window.focus();
      note.close();
      if (onOpen) onOpen();
    };
    return note;
  } catch {
    return null; // e.g. some mobile browsers only allow notifications from a service worker
  }
}

/** True when the person is not looking at this tab. */
export const isBackground = () => typeof document !== 'undefined' && (document.visibilityState === 'hidden' || !document.hasFocus());
