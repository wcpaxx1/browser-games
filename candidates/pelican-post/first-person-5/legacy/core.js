/* Pelican Post — original game rules, no dependencies. MIT licensed. */
(function (root) {
  'use strict';
  const KEY = 'pelican-post:save:v1', VERSION = 1, LENGTH = 3600;
  const THEMES = ['薄荷海湾', '珊瑚沙洲', '暮色灯塔', '星潮海岸'];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function random(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function map(seed, stage) {
    const rng = random((seed ^ Math.imul(stage, 2654435761)) >>> 0), items = [];
    for (let i = 0; i < 14; i++) {
      const x = 360 + i * 215, lane = Math.floor(rng() * 3);
      items.push({id: i, x, lane, type: 'stamp'});
      if (i > 1) items.push({id: 20 + i, x: x + 100, lane: Math.floor(rng() * 3), type: (i + stage) % 2 ? 'crab' : 'wood'});
    }
    return {items, length: LENGTH, quota: Math.min(8, 5 + Math.floor((stage - 1) / 3)), theme: (stage - 1) % 4, wind: ((stage - 1) % 3 - 1) * 10};
  }
  function newRun() { return {x: 0, lane: 1, hp: 3, stamps: 0, taken: [], hit: [], jump: 0, cooldown: 0, status: 'ready'}; }
  function fresh(seed = 20261012) { return {version: VERSION, seed: seed >>> 0, stage: 1, best: 0, total: 0, settings: {sound: false, reduced: false}, run: newRun()}; }
  function speed(state) { return 126 + Math.min(34, (state.stage - 1) * 3) + ((state.stage - 1) % 3 - 1) * 10; }
  function act(state, action) {
    const r = state.run;
    if (r.status !== 'riding') return false;
    if (action === 'up') r.lane = clamp(r.lane - 1, 0, 2);
    else if (action === 'down') r.lane = clamp(r.lane + 1, 0, 2);
    else if (typeof action === 'number' && Number.isFinite(action)) r.lane = clamp(Math.floor(action), 0, 2);
    else if (action === 'jump' && r.cooldown <= 0) { r.jump = .85; r.cooldown = 1.25; return true; }
    return false;
  }
  function step(state, dt, route) {
    const r = state.run;
    if (r.status !== 'riding') return [];
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
    const events = [], prev = r.x;
    r.x = Math.min(LENGTH, r.x + speed(state) * dt);
    r.jump = Math.max(0, r.jump - dt); r.cooldown = Math.max(0, r.cooldown - dt);
    for (const o of route.items) {
      if (o.x < prev - 27 || o.x > r.x + 27 || o.lane !== r.lane) continue;
      if (o.type === 'stamp' && !r.taken.includes(o.id)) { r.taken.push(o.id); r.stamps++; events.push('stamp'); }
      else if (o.type !== 'stamp' && !r.hit.includes(o.id) && r.jump <= 0) {
        r.hit.push(o.id); r.hp--; events.push('hit');
        if (r.hp <= 0) { r.status = 'failed'; events.push('failed'); break; }
      }
    }
    if (r.status === 'riding' && r.x >= LENGTH) {
      r.status = r.stamps >= route.quota ? 'cleared' : 'failed';
      if (r.status === 'cleared') { state.best = Math.max(state.best, state.stage); state.total = Math.min(Number.MAX_SAFE_INTEGER, state.total + r.stamps); }
      events.push(r.status);
    }
    return events;
  }
  function next(state) {
    if (state.run.status !== 'cleared') return false;
    if (state.stage >= 1000000000) { state.seed = (state.seed + 2654435761) >>> 0; state.stage = 1; } else state.stage++;
    state.run = newRun(); return true;
  }
  const int = (v,a,b) => Number.isInteger(v) && v >= a && v <= b, num = (v,a,b) => Number.isFinite(v) && v >= a && v <= b;
  function validate(v) {
    if (!v || v.version !== VERSION || !int(v.seed,0,4294967295) || !int(v.stage,1,1000000000) || !int(v.best,0,1000000000) || !int(v.total,0,Number.MAX_SAFE_INTEGER)) throw Error('存档版本或数值无效');
    if (!v.settings || typeof v.settings.sound !== 'boolean' || typeof v.settings.reduced !== 'boolean') throw Error('设置无效');
    const r = v.run;
    if (!r || !num(r.x,0,LENGTH) || !int(r.lane,0,2) || !int(r.hp,0,3) || !int(r.stamps,0,14) || !num(r.jump,0,.85) || !num(r.cooldown,0,1.25) || !['ready','riding','paused','cleared','failed'].includes(r.status)) throw Error('旅程数据无效');
    for (const [key,a,b] of [['taken',0,13],['hit',22,33]]) if (!Array.isArray(r[key]) || r[key].length > 14 || !r[key].every(x => int(x,a,b)) || new Set(r[key]).size !== r[key].length) throw Error('收集数据无效');
    if (r.stamps !== r.taken.length || r.hp !== Math.max(0,3-r.hit.length)) throw Error('进度不一致');
    if (r.status === 'cleared' && (r.x !== LENGTH || r.stamps < map(v.seed,v.stage).quota || r.hp === 0)) throw Error('通关数据无效');
    if (['ready','riding','paused'].includes(r.status) && r.hp === 0) throw Error('生命值无效');
    return {version:VERSION, seed:v.seed, stage:v.stage, best:v.best, total:v.total, settings:{sound:v.settings.sound,reduced:v.settings.reduced}, run:{x:r.x,lane:r.lane,hp:r.hp,stamps:r.stamps,taken:[...r.taken],hit:[...r.hit],jump:r.jump,cooldown:r.cooldown,status:r.status}};
  }
  function encode(state) { return JSON.stringify(validate(state)); }
  function decode(text) { if (typeof text !== 'string' || text.length > 65536) throw Error('存档文件过大'); return validate(JSON.parse(text)); }
  function load(storage, seed) {
    try { const raw = storage.getItem(KEY); if (!raw) return {state:fresh(seed),notice:'旅程将自动保存在此浏览器'}; const state = decode(raw); if (state.run.status === 'riding') state.run.status = 'paused'; return {state,notice:'已恢复本地旅程'}; }
    catch (e) { return {state:fresh(seed),notice:'无法读取或存档损坏，已安全开启新旅程；可导入备份',error:true}; }
  }
  function save(storage, state) { try { storage.setItem(KEY,encode(state)); return true; } catch { return false; } }
  const api = {KEY,VERSION,LENGTH,THEMES,random,map,fresh,newRun,speed,act,step,next,validate,encode,decode,load,save};
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Pelican = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
