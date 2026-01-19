import { describe, it, expect, vi } from 'vitest';
import { ListenerRegistry } from '../listener-registry.js';

const noop = () => {};

describe('ListenerRegistry', () => {
  it('manages listeners and prevents duplicates', () => {
    const registry = new ListenerRegistry<[], void>();

    expect(registry.size).toBe(0);
    expect(registry.has(noop)).toBe(false);
    expect(registry.lacks(noop)).toBe(true);

    registry.on(noop);
    registry.on(noop);
    expect(registry.size).toBe(1);
    expect(registry.has(noop)).toBe(true);

    registry.off(noop);
    expect(registry.size).toBe(0);
    expect(registry.has(noop)).toBe(false);
  });

  it('invokes listeners once when registered with once', () => {
    const registry = new ListenerRegistry<[number], number>();
    const listener = vi.fn((v: number) => v * 2);

    const added = registry.once(listener);
    expect(added).toBe(true);
    expect(registry.has(listener)).toBe(true);

    const [result] = registry.dispatch(2);
    expect(result).toBe(4);

    expect(registry.size).toBe(0);
    expect(registry.has(listener)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('allows off() with original listener after once()', () => {
    const registry = new ListenerRegistry<[number], number>();
    const listener = vi.fn((v: number) => v * 2);

    registry.once(listener);
    expect(registry.has(listener)).toBe(true);
    expect(registry.size).toBe(1);

    registry.off(listener);
    expect(registry.has(listener)).toBe(false);
    expect(registry.size).toBe(0);

    registry.dispatch(2);
    expect(listener).not.toHaveBeenCalled();
  });

  it('once returns false when listener already exists', () => {
    const registry = new ListenerRegistry<[number], number>();
    const listener = vi.fn((v: number) => v * 2);

    registry.on(listener);
    const added = registry.once(listener);

    expect(registry.size).toBe(1);
    expect(registry.has(listener)).toBe(true);

    expect(added).toBe(false);
  });

  it('dispatches in snapshot order and handles async results', async () => {
    const registry = new ListenerRegistry<[string], Promise<string> | Promise<number>>();
    const calls: Array<string | number> = [];

    registry.on(async (value) => {
      calls.push(`a:${value}`);
      return value.toUpperCase();
    });
    registry.on(async (value) => {
      calls.push(`b:${value}`);
      return value.length;
    });

    const [first, second] = registry.dispatch('hi');

    await expect(first).resolves.toBe('HI');
    await expect(second).resolves.toBe(2);
    expect(calls).toEqual(['a:hi', 'b:hi']);
  });

  it('uses dispatch snapshot so mutations mid-dispatch do not affect current cycle', async () => {
    const registry = new ListenerRegistry<[], void>();
    const first = vi.fn(() => {
      registry.off(first);
      registry.on(second);
    });
    const second = vi.fn();

    registry.on(first);

    const [firstResult] = registry.dispatch();
    await firstResult;

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    const [nextFirst, nextSecond] = registry.dispatch();
    await Promise.all([nextFirst, nextSecond]);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('returns rejected promise when listener throws while continuing others', async () => {
    const registry = new ListenerRegistry<[], string>();
    const safe = vi.fn(() => 'ok');
    const failing = vi.fn(() => {
      throw new Error('boom');
    });

    registry.on(safe);
    registry.on(failing);

    const settled = await Promise.allSettled(registry.dispatch());

    expect(settled.some((r) => r.status === 'fulfilled' && r.value === 'ok')).toBe(true);
    const rejection = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    expect(rejection).toBeDefined();
    expect(rejection?.reason).toBeInstanceOf(Error);
    expect((rejection?.reason as Error).message).toBe('boom');
  });

  it('clears listeners and resets size', () => {
    const registry = new ListenerRegistry<[], void>();
    registry.on(noop);
    registry.on(() => {});

    expect(registry.size).toBe(2);
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.dispatch()).toEqual([]);
  });

  it('returns false when trying to remove a missing listener', () => {
    const registry = new ListenerRegistry<[], void>();
    expect(registry.off(noop)).toBe(false);
  });

  it('dispatches with 3 arguments', () => {
    const registry = new ListenerRegistry<[number, string, boolean], string>();
    const listener = vi.fn((a: number, b: string, c: boolean) => `${a}-${b}-${c}`);
    registry.on(listener);
    const [result] = registry.dispatch(1, 'two', true);
    expect(result).toBe('1-two-true');
    expect(listener).toHaveBeenCalledWith(1, 'two', true);
  });

  it('dispatches with 4 arguments', () => {
    const registry = new ListenerRegistry<[number, number, number, number], number>();
    const listener = vi.fn((a: number, b: number, c: number, d: number) => a + b + c + d);
    registry.on(listener);
    const [result] = registry.dispatch(1, 2, 3, 4);
    expect(result).toBe(10);
    expect(listener).toHaveBeenCalledWith(1, 2, 3, 4);
  });

  it('dispatches with 5 arguments', () => {
    const registry = new ListenerRegistry<[number, number, number, number, number], number>();
    const listener = vi.fn((a: number, b: number, c: number, d: number, e: number) => a + b + c + d + e);
    registry.on(listener);
    const [result] = registry.dispatch(1, 2, 3, 4, 5);
    expect(result).toBe(15);
    expect(listener).toHaveBeenCalledWith(1, 2, 3, 4, 5);
  });

  it('dispatches with 6+ arguments using spread', () => {
    const registry = new ListenerRegistry<[number, number, number, number, number, number], number>();
    const listener = vi.fn((a: number, b: number, c: number, d: number, e: number, f: number) => a + b + c + d + e + f);
    registry.on(listener);
    const [result] = registry.dispatch(1, 2, 3, 4, 5, 6);
    expect(result).toBe(21);
    expect(listener).toHaveBeenCalledWith(1, 2, 3, 4, 5, 6);
  });

  it('returns [] when snapshot is empty while listeners exist (defensive guard)', () => {
    const registry = new ListenerRegistry<[], void>();
    const listener = () => {};

    // Capture the registry's internal Map to force an empty iterator for keys()
    const originalSet = Map.prototype.set;
    const originalKeys = Map.prototype.keys;
    let capturedMap: Map<unknown, unknown> | undefined;
    try {
      Map.prototype.set = function set(this: Map<unknown, unknown>, key, value) {
        capturedMap ??= this;
        return originalSet.call(this, key, value);
      };

      registry.on(listener);

      Map.prototype.keys = function keys(this: Map<unknown, unknown>) {
        if (this === capturedMap) {
          return [][Symbol.iterator]();
        }
        return originalKeys.call(this);
      };

      const results = registry.dispatch();
      expect(results).toEqual([]);
    } finally {
      Map.prototype.set = originalSet;
      Map.prototype.keys = originalKeys;
    }
  });
});
