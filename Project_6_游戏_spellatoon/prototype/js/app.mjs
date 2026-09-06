import { CONFIG } from './config.mjs';
import { createInitialState } from './rules.mjs';
import { renderApp, stateToText } from './render.mjs';
import { createInputController } from './input.mjs';

const localPlayerId = CONFIG.players[0].id;
let state = createInitialState({ config: CONFIG, random: () => 0 });
const elements = {
  board: document.querySelector('#board'),
  playerList: document.querySelector('#player-list'),
  hand: document.querySelector('#hand'),
  turnChip: document.querySelector('#turn-chip'),
  turnNumber: document.querySelector('#turn-number'),
  starterName: document.querySelector('#starter-name'),
  localPlayerName: document.querySelector('#local-player-name'),
  statusMessage: document.querySelector('#status-message'),
  handCount: document.querySelector('#hand-count'),
  eventMessage: document.querySelector('#event-message'),
  previewMessage: document.querySelector('#preview-message'),
  resultMessage: document.querySelector('#result-message'),
  moveMode: document.querySelector('#move-mode'),
  deployMode: document.querySelector('#deploy-mode'),
  confirmAction: document.querySelector('#confirm-action'),
  clearSelection: document.querySelector('#clear-selection'),
  endTurn: document.querySelector('#end-turn'),
  actionHint: document.querySelector('#action-hint'),
};
const selection = {
  selectedCardId: null,
  mode: null,
  path: [],
  reachable: [],
  previewCell: null,
  previewHoverCell: null,
  previewTargets: [],
  previewResult: null,
  previewNotice: '',
  feedback: '',
  feedbackTone: 'neutral',
};
let virtualTime = 0;

elements.board.style.setProperty('--board-size', CONFIG.board.size);

function render() {
  renderApp(elements, state, localPlayerId, selection);
}

createInputController({
  elements,
  getState: () => state,
  getSelection: () => selection,
  setState: (nextState) => { state = nextState; },
  render,
  localPlayerId,
  config: CONFIG,
});

window.render_game_to_text = () => stateToText(state, localPlayerId);
window.advanceTime = (ms = 0) => {
  virtualTime += Number(ms) || 0;
  render();
};
render();
