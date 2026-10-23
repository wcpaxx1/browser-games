/** App-only move replacement. The v0.3 rule engine and canonical save format stay unchanged. */
import * as Engine from './engine/index.mjs';

const verified = new WeakSet();
let cachedState = null, cachedRevision = null;

function remember(before, after) {
  const action = after.log.at(-1);
  let revision = null;
  if (action?.type === 'move') {
    const piece = before.pieces.find(p => p.id === action.pieceId);
    revision = Object.freeze({
      before, after, action, pieceId: piece.id, player: piece.controller,
      from: piece.node, to: action.to,
      moves: Object.freeze(Engine.legalMoves(before).filter(a => a.pieceId === piece.id))
    });
    verified.add(revision);
  }
  cachedState = after;
  cachedRevision = revision;
  return revision;
}

/** Every board argument must be an engine-owned, immutable state, never an imported snapshot. */
export function getRevision(state) {
  Engine.positionKey(state);
  if (cachedState === state) return cachedRevision;
  if (state.log.at(-1)?.type !== 'move') {
    cachedState = state;
    cachedRevision = null;
    return null;
  }
  let before = Engine.createInitialState({firstPlayer: state.firstPlayer});
  for (const action of state.log.slice(0, -1)) before = Engine.applyAction(before, action);
  // Restored games have already been fully replay-validated by Engine.restore.
  // Replaying only the prefix reconstructs the complete original board and history.
  return remember(before, state);
}

/** A normal committed event closes the old revision window, even for pass/withdraw/draw. */
export function applyAction(state, action) {
  const next = Engine.applyAction(state, action);
  remember(state, next);
  return next;
}

/** Replace, never append: any repeated replacement retains exactly the same original before. */
export function replaceMove(state, revision, to) {
  Engine.positionKey(state);
  if (!revision || !verified.has(revision) || revision.after !== state ||
      state.log.at(-1) !== revision.action) {
    throw new Error('这一步已被后续事件锁定，不能重下。');
  }
  const move = revision.moves.find(a => a.to === to);
  if (!move) throw new Error('必须从原起点按规则重下，不能从首次落点再走一步。');
  const next = Engine.applyAction(revision.before, move);
  remember(revision.before, next);
  return next;
}
