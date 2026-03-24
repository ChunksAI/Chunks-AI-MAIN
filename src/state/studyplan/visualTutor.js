/**
 * src/state/studyplan/visualTutor.js — Visual Tutor bridge
 */

import { sp } from './state.js';
import { spCloseExplainDrawer } from './explain.js';
import { showScreen } from '../navigation/index.js';
import { setNavFromHistory } from '../navigation/screens.js';

export function spOpenVisualTutor() {
  if (!sp.drawerConcept) return;
  spCloseExplainDrawer();
  const q = sp.drawerConcept.title + (
    sp.drawerConcept.description ? ' — ' + sp.drawerConcept.description.slice(0, 80) : ''
  );
  if (typeof window._vtOpenForConcept === 'function') {
    window._vtOpenForConcept(sp.drawerConcept.title, q);
  } else if (typeof showScreen === 'function') {
    setNavFromHistory(true);
    showScreen('visual');
    setTimeout(() => {
      if (window._vtAsk) window._vtAsk('explain ' + q);
    }, 400);
  }
}
