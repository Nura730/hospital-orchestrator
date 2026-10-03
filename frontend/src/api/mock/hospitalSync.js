/**
 * @file hospitalSync.js
 * One shared, live hospital for every open tab.
 *
 * The demo hospital (flowMock + careMock) lives in memory. After every change, `commit()` saves a
 * snapshot to localStorage and announces it on a BroadcastChannel; other tabs load the snapshot and
 * every page refreshes through the local 'hospital.changed' event. Each tab keeps its own login
 * (sessionStorage), so a patient, doctor, OT manager, nurse and admin can run side by side and
 * see each other's actions immediately.
 */

import { exportFlowState, importFlowState } from './flowMock.js';
import { exportCareState, importCareState } from './careMock.js';
import { liveEmitter } from './liveEmitter.js';

export const HOSPITAL_CHANGED = 'hospital.changed';

const KEY = 'mediorchestra_hospital_v2';
const VERSION = 2;
const TAB_ID = Math.random().toString(36).slice(2, 10);

let rev = 0;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mediorchestra-hospital') : null;

function readSnapshot() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    return snap && snap.v === VERSION ? snap : null;
  } catch {
    return null;
  }
}

/**
 * Load a snapshot into this tab (the one in the message, else the stored one).
 * Returns true when it was newer and got applied.
 */
function hydrate(given = null) {
  const snap = given && given.v === VERSION ? given : readSnapshot();
  if (!snap || snap.rev <= rev) return false;
  try {
    importFlowState(snap.flow);
    if (snap.care) importCareState(snap.care);
    rev = snap.rev;
    return true;
  } catch (err) {
    console.warn('[hospitalSync] could not load shared state', err);
    return false;
  }
}

/**
 * Save the current hospital, tell the other tabs, and refresh this tab's pages.
 * @param {string} reason short description shown in debugging / feed
 */
export function commit(reason = 'update') {
  try {
    const latest = readSnapshot();
    rev = Math.max(rev, latest ? latest.rev : 0) + 1;
    const snap = { v: VERSION, rev, at: Date.now(), from: TAB_ID, reason, flow: exportFlowState(), care: exportCareState() };
    localStorage.setItem(KEY, JSON.stringify(snap));
    // Send the snapshot itself: localStorage reaches other tabs asynchronously, so a bare
    // "something changed" message can arrive before the data does.
    channel?.postMessage({ rev, from: TAB_ID, reason, snap });
  } catch (err) {
    console.warn('[hospitalSync] could not share state', err);
  }
  liveEmitter.emit(HOSPITAL_CHANGED, { reason, local: true });
}

function onRemote(msg) {
  if (!msg || msg.from === TAB_ID) return;
  if (hydrate(msg.snap)) liveEmitter.emit(HOSPITAL_CHANGED, { reason: msg.reason, remote: true });
}

if (typeof window !== 'undefined') {
  // Join the shared hospital if another tab already created it; otherwise publish ours.
  if (!hydrate()) commit('init');
  if (channel) {
    channel.onmessage = (e) => onRemote(e.data);
  } else {
    window.addEventListener('storage', (e) => {
      if (e.key === KEY && e.newValue) {
        const snap = JSON.parse(e.newValue);
        onRemote({ from: snap.from, reason: snap.reason, snap });
      }
    });
  }
}

/** Forget the shared hospital (used by "Reset demo data"). */
export function resetShared() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
