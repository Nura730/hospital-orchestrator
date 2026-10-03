/**
 * @file uiStore.js
 * Zustand store for UI layout states, theme (dark/light), modal/drawer orchestration, and department filtering.
 */

import { create } from 'zustand';
import { AUTONOMY_MODES } from '../utils/constants.js';

const THEME_KEY = 'mediorchestra_theme_v2';

/** Light (cream #F8F3F0 + royal blue #014BAA) is the default; dark only when the user picks it. */
function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // storage unavailable
  }
  return 'light';
}

export const useUiStore = create((set, get) => ({
  theme: getInitialTheme(),
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  selectedDepartment: 'all',
  autonomyMode: AUTONOMY_MODES.APPROVAL,
  globalSearch: '',
  activeModal: null, // { type: 'bed_suggestion' | 'emergency_ot' | 'reject_rec', props: {} }
  activeDrawer: null, // { type: 'floor_block' | 'equipment_detail' | 'rec_detail' | 'patient_detail', props: {} }

  /**
   * Set color theme (dark or light) and update DOM html class.
   */
  setTheme: (newTheme) => {
    try {
      localStorage.setItem(THEME_KEY, newTheme);
      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } catch (e) {
      console.warn('Error saving theme', e);
    }
    set({ theme: newTheme });
  },

  /**
   * Toggle between dark and light themes.
   */
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  /**
   * Toggle sidebar collapse state for desktop.
   */
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  /**
   * Toggle mobile navigation drawer.
   */
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  /**
   * Filter active department across views.
   */
  setSelectedDepartment: (dept) => set({ selectedDepartment: dept }),

  /**
   * Global search input text.
   */
  setGlobalSearch: (q) => set({ globalSearch: q }),

  /**
   * Set autonomy mode.
   */
  setAutonomyMode: (mode) => set({ autonomyMode: mode }),

  /**
   * Open modal dialog.
   */
  openModal: (type, props = {}) => set({ activeModal: { type, props } }),
  closeModal: () => set({ activeModal: null }),

  /**
   * Open slide-out detail drawer.
   */
  openDrawer: (type, props = {}) => set({ activeDrawer: { type, props } }),
  closeDrawer: () => set({ activeDrawer: null }),
}));
