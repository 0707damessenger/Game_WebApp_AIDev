import { CONFIG } from './config.mjs';
import { createInitialState } from './rules.mjs';
import { renderApp, stateToText } from './render.mjs';

const localPlayerId = CONFIG.players[0].id;
const state = createInitialState({ config: CONFIG });
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
};
let virtualTime = 0;

elements.board.style.setProperty('--board-size', CONFIG.board.size);

function render() {
  renderApp(elements, state, localPlayerId);
}

window.render_game_to_text = () => stateToText(state, localPlayerId);
window.advanceTime = (ms = 0) => {
  virtualTime += Number(ms) || 0;
  render();
};
render();
