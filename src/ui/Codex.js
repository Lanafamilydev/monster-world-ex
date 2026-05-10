import { P, savePlayer } from '../core/playerState.js';

export function toggleCodex() {
  const overlay = document.getElementById('codex-overlay');
  if (overlay) {
    overlay.classList.toggle('show');
  }
}
