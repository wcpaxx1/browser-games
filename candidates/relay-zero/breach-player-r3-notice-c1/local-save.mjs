// Supply game-specific defaults, validator, and optional migration.
export function createLocalSave({key, version = 1, defaults, validate,
  migrate, storage = () => globalThis.localStorage, maxChars = 65536}) {
  if (!key || !Number.isInteger(version) || version < 1) throw new Error('Invalid save configuration');
  let data, blocked = false;
  const clone = value => JSON.parse(JSON.stringify(value));
  const valid = value => {
    const visit = (v, seen = new Set()) => {
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v !== 'object' || seen.has(v)) return false;
      seen.add(v);
      const ok = (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype) &&
        Object.values(v).every(x => visit(x, seen));
      seen.delete(v); return ok;
    };
    try { return visit(value) && validate(value) === true; } catch { return false; }
  };
  if (!valid(defaults)) throw new Error('Invalid defaults');
  data = clone(defaults);
  const result = (status, persisted = false) => ({status, persisted, data: clone(data)});
  const encode = value => {
    if (!valid(value)) throw new Error('Invalid data');
    const raw = JSON.stringify({version, data: value});
    if (raw.length > maxChars) throw new Error('Oversized data');
    return raw;
  };
  const decode = raw => {
    if (typeof raw !== 'string' || raw.length > maxChars) throw new Error('Invalid size');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Number.isInteger(parsed.version)) throw new Error('Invalid envelope');
    let value = parsed.data;
    if (parsed.version !== version) {
      if (parsed.version > version || !migrate) throw new Error('Unsupported version');
      value = migrate(parsed.data, parsed.version, version);
    }
    if (!valid(value)) throw new Error('Invalid data');
    encode(value); return clone(value);
  };
  const write = value => {
    let raw;
    try { raw = encode(value); } catch { return result('invalid'); }
    data = clone(value);
    if (blocked) return result('replacement-confirmation-required');
    try { storage().setItem(key, raw); return result('saved', true); }
    catch { return result('memory-only'); }
  };
  return {
    load() {
      let raw;
      try { raw = storage().getItem(key); } catch { return result('unavailable'); }
      if (raw === null) { blocked = false; return result('empty'); }
      try { data = decode(raw); blocked = false; return result('loaded', true); }
      catch { blocked = true; return result('unreadable-preserved'); }
    },
    save: write,
    export(value = data) { return encode(value); },
    import(raw, {confirmed = false} = {}) {
      if (!confirmed) return result('replacement-confirmation-required');
      let next; try { next = decode(raw); } catch { return result('invalid-import'); }
      blocked = false; return write(next);
    },
    reset({confirmed = false} = {}) {
      if (!confirmed) return result('reset-confirmation-required');
      try { storage().removeItem(key); blocked = false; data = clone(defaults); return result('reset', true); }
      catch { return result('reset-failed'); }
    }
  };
}
