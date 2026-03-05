import { test as fcTest, fc } from '@fast-check/vitest';
import { Broadcast, ConsumerHandle } from '../broadcast';

const noGC = typeof globalThis.gc !== 'function';

describe('Broadcast', () => {
  it('should create a broadcast', () => {
    const broadcast = new Broadcast<number>();
    expect(broadcast.size).toBe(0);
    expect(broadcast[Symbol.toStringTag]).toBe('Broadcast');
  });

  it('should join and leave consumers', () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    expect(broadcast.size).toBe(1);

    const handle2 = broadcast.join();
    expect(broadcast.size).toBe(2);

    broadcast.leave(handle1);
    expect(broadcast.size).toBe(1);

    broadcast.leave(handle2);
    expect(broadcast.size).toBe(0);
  });

  it('should push and consume values', () => {
    const broadcast = new Broadcast<string>();
    const handle = broadcast.join();

    broadcast.emit('a');
    broadcast.emit('b');
    broadcast.emit('c');

    expect(broadcast.readable(handle)).toBe(true);
    expect(broadcast.consume(handle)).toBe('a');
    expect(broadcast.consume(handle)).toBe('b');
    expect(broadcast.consume(handle)).toBe('c');
    expect(broadcast.readable(handle)).toBe(false);
  });

  it('should support multiple consumers reading same values', () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    broadcast.emit(1);
    broadcast.emit(2);

    const handle2 = broadcast.join();
    broadcast.emit(3);

    expect(broadcast.consume(handle1)).toBe(1);
    expect(broadcast.consume(handle1)).toBe(2);
    expect(broadcast.consume(handle1)).toBe(3);

    expect(broadcast.consume(handle2)).toBe(3);
    expect(broadcast.readable(handle2)).toBe(false);
  });

  it('should compact buffer when all consumers pass a position', () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    const handle2 = broadcast.join();

    broadcast.emit(1);
    broadcast.emit(2);
    broadcast.emit(3);

    broadcast.consume(handle1);
    broadcast.consume(handle1);
    broadcast.consume(handle2);

    broadcast.consume(handle1);
    broadcast.consume(handle2);
    broadcast.consume(handle2);

    expect(broadcast.readable(handle1)).toBe(false);
    expect(broadcast.readable(handle2)).toBe(false);
  });

  it('should support Symbol.dispose on handles', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    expect(broadcast.size).toBe(1);

    handle[Symbol.dispose]();
    expect(broadcast.size).toBe(0);
  });

  it('should not allow cursor tampering', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();

    broadcast.emit(1);
    broadcast.emit(2);

    const cursor = handle.cursor;
    expect(cursor).toBe(0);

    expect(() => {
      (handle as any).cursor = 999;
    }).toThrow();

    expect(handle.cursor).toBe(0);

    broadcast.consume(handle);
    expect(handle.cursor).toBe(1);
  });

  it.skipIf(noGC)('should clean up via FinalizationRegistry when handle is garbage collected', async () => {
    const broadcast = new Broadcast<number>();

    let handle: ConsumerHandle | null = broadcast.join();
    broadcast.emit(1);
    expect(broadcast.size).toBe(1);

    handle = null;
    gc();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(broadcast.size).toBe(0);
  });

  it('should handle leave being called twice (idempotent)', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();

    broadcast.leave(handle);
    expect(broadcast.size).toBe(0);

    broadcast.leave(handle);
    expect(broadcast.size).toBe(0);
  });

  it('should receive values via Promise interface', async () => {
    const broadcast = new Broadcast<number>();

    const promise = broadcast.receive();
    broadcast.emit(42);

    const value = await promise;
    expect(value).toBe(42);
  });

  it('should return true from emit when active', () => {
    const broadcast = new Broadcast<number>();

    const result = broadcast.emit(42);
    expect(result).toBe(true);
  });

  it('should return false from emit when disposed', () => {
    const broadcast = new Broadcast<number>();
    broadcast[Symbol.dispose]();

    const result = broadcast.emit(42);
    expect(result).toBe(false);
  });

  it('should work as async iterator', async () => {
    const broadcast = new Broadcast<number>();
    const values: number[] = [];

    const iteratorPromise = (async () => {
      const iterator = broadcast[Symbol.asyncIterator]();
      for (let i = 0; i < 3; i++) {
        const result = await iterator.next();
        if (!result.done) {
          values.push(result.value);
        }
      }
      await iterator.return!();
    })();

    await Promise.resolve();
    broadcast.emit(1);
    await Promise.resolve();
    broadcast.emit(2);
    await Promise.resolve();
    broadcast.emit(3);

    await iteratorPromise;
    expect(values).toEqual([1, 2, 3]);
  });

  it('should clean up iterator on return', async () => {
    const broadcast = new Broadcast<number>();

    const iterator = broadcast[Symbol.asyncIterator]();
    expect(broadcast.size).toBe(1);

    await iterator.return!();
    expect(broadcast.size).toBe(0);
  });

  it('should call dispose without error', () => {
    const broadcast = new Broadcast<number>();
    expect(() => broadcast.dispose()).not.toThrow();
  });

  it('should dispose via Symbol.dispose', () => {
    const broadcast = new Broadcast<number>();
    expect(() => broadcast[Symbol.dispose]()).not.toThrow();
  });

  it('should be idempotent on double dispose', () => {
    const broadcast = new Broadcast<number>();
    broadcast[Symbol.dispose]();
    expect(() => broadcast[Symbol.dispose]()).not.toThrow();
  });

  it('should update min cursor when non-min consumer leaves', () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    broadcast.emit(1);
    broadcast.emit(2);

    const handle2 = broadcast.join();

    broadcast.consume(handle1);
    broadcast.consume(handle1);

    broadcast.leave(handle2);
    expect(broadcast.size).toBe(1);
    expect(broadcast.readable(handle1)).toBe(false);
  });

  it('should update min cursor when min consumer leaves with multiple consumers', () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    const handle2 = broadcast.join();

    broadcast.emit(1);
    broadcast.emit(2);
    broadcast.emit(3);

    broadcast.consume(handle2);
    broadcast.consume(handle2);

    broadcast.leave(handle1);

    expect(broadcast.size).toBe(1);
    expect(handle2.cursor).toBe(2);
    expect(broadcast.readable(handle2)).toBe(true);
  });

  it.skipIf(noGC)('should handle GC cleanup for multiple handles', async () => {
    const broadcast = new Broadcast<number>();

    let handle1: ConsumerHandle | null = broadcast.join();
    let handle2: ConsumerHandle | null = broadcast.join();
    broadcast.emit(1);

    expect(broadcast.size).toBe(2);

    handle1 = null;
    gc();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(broadcast.size).toBe(1);

    handle2 = null;
    gc();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(broadcast.size).toBe(0);
  });

  it.skipIf(noGC)('should handle mixed manual and GC release', async () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    let handle2: ConsumerHandle | null = broadcast.join();
    expect(broadcast.size).toBe(2);

    broadcast.leave(handle1);
    expect(broadcast.size).toBe(1);

    handle2 = null;
    gc();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(broadcast.size).toBe(0);
  });

  it('should compact after consume advances past min', () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    const handle2 = broadcast.join();

    broadcast.emit(1);
    broadcast.emit(2);
    broadcast.emit(3);

    expect(handle1.cursor).toBe(0);
    expect(handle2.cursor).toBe(0);

    broadcast.consume(handle1);
    expect(handle1.cursor).toBe(1);

    broadcast.consume(handle2);
    expect(handle2.cursor).toBe(1);

    expect(broadcast.consume(handle1)).toBe(2);
    expect(broadcast.consume(handle2)).toBe(2);
    expect(broadcast.consume(handle1)).toBe(3);
    expect(broadcast.consume(handle2)).toBe(3);
  });

  it('should work with for-await-of', async () => {
    const broadcast = new Broadcast<number>();
    const values: number[] = [];

    const consumerPromise = (async () => {
      let count = 0;
      for await (const value of broadcast) {
        values.push(value);
        count++;
        if (count >= 3) break;
      }
    })();

    await Promise.resolve();
    broadcast.emit(10);
    await Promise.resolve();
    broadcast.emit(20);
    await Promise.resolve();
    broadcast.emit(30);

    await consumerPromise;
    expect(values).toEqual([10, 20, 30]);
  });

  it('should handle consumer joining after values emitted', () => {
    const broadcast = new Broadcast<number>();

    broadcast.emit(1);
    broadcast.emit(2);

    const handle = broadcast.join();

    broadcast.emit(3);

    expect(broadcast.readable(handle)).toBe(true);
    expect(broadcast.consume(handle)).toBe(3);
    expect(broadcast.readable(handle)).toBe(false);
  });

  it('should return cursor 0 for first consumer on empty broadcast', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    expect(handle.cursor).toBe(0);
  });

  it('should not compact when leaving non-min consumer', () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    const handle2 = broadcast.join();

    broadcast.emit(1);
    broadcast.emit(2);

    broadcast.consume(handle2);
    broadcast.consume(handle2);

    broadcast.leave(handle2);

    expect(broadcast.size).toBe(1);
    expect(handle1.cursor).toBe(0);
    expect(broadcast.readable(handle1)).toBe(true);
  });

  it.skipIf(noGC)('should not compact via GC when non-min consumer is collected', async () => {
    const broadcast = new Broadcast<number>();

    const handle1 = broadcast.join();
    let handle2: ConsumerHandle | null = broadcast.join();

    broadcast.emit(1);
    broadcast.emit(2);

    broadcast.consume(handle2);
    broadcast.consume(handle2);

    expect(broadcast.size).toBe(2);

    handle2 = null;
    gc();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(broadcast.size).toBe(1);
    expect(handle1.cursor).toBe(0);
    expect(broadcast.readable(handle1)).toBe(true);
  });

  it('should handle shift of zero during compaction', () => {
    const broadcast = new Broadcast<number>();

    const handle = broadcast.join();
    broadcast.emit(1);

    broadcast.consume(handle);

    expect(broadcast.readable(handle)).toBe(false);
  });

  it('should support handleEvent for DOM EventListener compatibility', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    broadcast.handleEvent(42);
    expect(broadcast.readable(handle)).toBe(true);
    expect(broadcast.consume(handle)).toBe(42);
  });

  it('should reject receive() when disposed', async () => {
    const broadcast = new Broadcast<number>();
    broadcast[Symbol.dispose]();
    await expect(broadcast.receive()).rejects.toThrow('Disposed');
  });

  it('should support then() Promise method', async () => {
    const broadcast = new Broadcast<number>();
    process.nextTick(() => broadcast.emit(42));
    const result = await broadcast.then((v) => v * 2);
    expect(result).toBe(84);
  });

  it('should support catch() Promise method', async () => {
    const broadcast = new Broadcast<number>();
    broadcast[Symbol.dispose]();
    const result = await broadcast.catch(() => 'caught');
    expect(result).toBe('caught');
  });

  it('should support finally() Promise method', async () => {
    const broadcast = new Broadcast<number>();
    const finallyFn = vi.fn();
    process.nextTick(() => broadcast.emit(42));
    await broadcast.finally(finallyFn);
    expect(finallyFn).toHaveBeenCalled();
  });

  it('should support sink getter', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    broadcast.sink(42);
    expect(broadcast.readable(handle)).toBe(true);
    expect(broadcast.consume(handle)).toBe(42);
  });

  it('should end iteration gracefully when disposed', async () => {
    const broadcast = new Broadcast<number>();
    const iterator = broadcast[Symbol.asyncIterator]();
    process.nextTick(() => broadcast[Symbol.dispose]());
    const result = await iterator.next();
    expect(result).toEqual({ value: undefined, done: true });
  });

  it('should throw on getCursor with invalid handle', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    broadcast.leave(handle);
    expect(() => broadcast.getCursor(handle)).toThrow('Invalid handle');
  });

  it('should throw on getCursor when handle mapping exists but cursor entry is gone', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    broadcast[Symbol.dispose]();
    expect(() => broadcast.getCursor(handle)).toThrow('Invalid handle');
  });

  it('should not lose data when consume() is called on empty buffer', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();

    expect(broadcast.readable(handle)).toBe(false);
    const cursorBefore = handle.cursor;

    expect(() => broadcast.consume(handle)).toThrow('No value available');

    expect(handle.cursor).toBe(cursorBefore);

    broadcast.emit(42);

    expect(broadcast.readable(handle)).toBe(true);
    expect(broadcast.consume(handle)).toBe(42);
  });

  it('should return done from tryConsume() without moving cursor when empty', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    const cursorBefore = handle.cursor;

    const result = broadcast.tryConsume(handle);

    expect(result).toEqual({ value: undefined, done: true });
    expect(handle.cursor).toBe(cursorBefore);
  });

  it('should allow consuming undefined payload with tryConsume()', () => {
    const broadcast = new Broadcast<number | undefined>();
    const handle = broadcast.join();

    broadcast.emit(undefined);

    const result = broadcast.tryConsume(handle);
    expect(result).toEqual({ value: undefined, done: false });
  });

  it('should throw from tryConsume() for invalid handle', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    broadcast.leave(handle);
    expect(() => broadcast.tryConsume(handle)).toThrow('Invalid handle');
  });

  it('should throw from tryConsume() when handle mapping exists but cursor entry is gone', () => {
    const broadcast = new Broadcast<number>();
    const handle = broadcast.join();
    broadcast[Symbol.dispose]();
    expect(() => broadcast.tryConsume(handle)).toThrow('Invalid handle');
  });

  it('should dispose via dispose() method', async () => {
    const broadcast = new Broadcast<number>();
    broadcast.dispose();
    await expect(broadcast.receive()).rejects.toThrow('Disposed');
  });

  it('should return done result from iterator return()', async () => {
    const broadcast = new Broadcast<number>();
    const iterator = broadcast[Symbol.asyncIterator]();
    const result = await iterator.return!();
    expect(result).toEqual({ value: undefined, done: true });
  });

  it('should read values correctly after repeated compaction', () => {
    const broadcast = new Broadcast<number>();
    const slow = broadcast.join();
    const fast = broadcast.join();

    for (let i = 0; i < 10; i++) broadcast.emit(i);

    for (let i = 0; i < 10; i++) {
      expect(broadcast.consume(fast)).toBe(i);
    }

    for (let i = 0; i < 10; i++) {
      expect(broadcast.consume(slow)).toBe(i);
    }
  });

  it('should read values correctly after leave triggers compaction', () => {
    const broadcast = new Broadcast<number>();
    const slow = broadcast.join();
    const fast = broadcast.join();

    for (let i = 0; i < 10; i++) broadcast.emit(i);

    for (let i = 0; i < 5; i++) broadcast.consume(fast);
    for (let i = 0; i < 3; i++) broadcast.consume(slow);

    broadcast.leave(slow);

    for (let i = 5; i < 10; i++) {
      expect(broadcast.consume(fast)).toBe(i);
    }
  });

  fcTest.prop([fc.array(fc.anything(), { minLength: 1, maxLength: 50 })])('single consumer sees all values in FIFO order', (values) => {
    const broadcast = new Broadcast<unknown>();
    const handle = broadcast.join();
    for (const v of values) broadcast.emit(v);
    for (const v of values) {
      expect(broadcast.consume(handle)).toBe(v);
    }
    expect(broadcast.readable(handle)).toBe(false);
  });

  fcTest.prop([fc.array(fc.integer(), { minLength: 1, maxLength: 50 })])('two consumers each see all values independently', (values) => {
    const broadcast = new Broadcast<number>();
    const h1 = broadcast.join();
    const h2 = broadcast.join();
    for (const v of values) broadcast.emit(v);

    for (const v of values) expect(broadcast.consume(h1)).toBe(v);
    for (const v of values) expect(broadcast.consume(h2)).toBe(v);

    expect(broadcast.readable(h1)).toBe(false);
    expect(broadcast.readable(h2)).toBe(false);
  });

  fcTest.prop([
    fc.array(fc.integer(), { minLength: 2, maxLength: 50 }),
    fc.integer({ min: 1 }),
  ])('late joiner only sees values after join', (values, splitRaw) => {
    const split = (splitRaw % (values.length - 1)) + 1;
    const broadcast = new Broadcast<number>();

    for (let i = 0; i < split; i++) broadcast.emit(values[i]);
    const handle = broadcast.join();
    for (let i = split; i < values.length; i++) broadcast.emit(values[i]);

    for (let i = split; i < values.length; i++) {
      expect(broadcast.consume(handle)).toBe(values[i]);
    }
    expect(broadcast.readable(handle)).toBe(false);
  });

  fcTest.prop([
    fc.array(fc.integer(), { minLength: 1, maxLength: 30 }),
    fc.integer({ min: 0 }),
  ])('interleaved consume preserves FIFO per consumer', (values, seedRaw) => {
    const broadcast = new Broadcast<number>();
    const h1 = broadcast.join();
    const h2 = broadcast.join();
    for (const v of values) broadcast.emit(v);

    let i1 = 0;
    let i2 = 0;
    let seed = Math.abs(seedRaw);
    while (i1 < values.length || i2 < values.length) {
      if (i1 < values.length && (i2 >= values.length || seed % 2 === 0)) {
        expect(broadcast.consume(h1)).toBe(values[i1]);
        i1++;
      } else if (i2 < values.length) {
        expect(broadcast.consume(h2)).toBe(values[i2]);
        i2++;
      }
      seed = (seed >>> 1) | 1;
    }
  });

  fcTest.prop([
    fc.array(fc.integer(), { minLength: 1, maxLength: 30 }),
  ])('leave during consumption does not corrupt other consumer', (values) => {
    const broadcast = new Broadcast<number>();
    const keeper = broadcast.join();
    const leaver = broadcast.join();
    for (const v of values) broadcast.emit(v);

    const mid = Math.floor(values.length / 2);
    for (let i = 0; i < mid; i++) broadcast.consume(leaver);
    broadcast.leave(leaver);

    for (const v of values) {
      expect(broadcast.consume(keeper)).toBe(v);
    }
  });

  fcTest.prop([fc.array(fc.integer(), { minLength: 0, maxLength: 20 })])('size reflects active consumers', (values) => {
    const broadcast = new Broadcast<number>();
    const handles = values.map(() => broadcast.join());
    expect(broadcast.size).toBe(handles.length);

    for (let i = 0; i < handles.length; i++) {
      broadcast.leave(handles[i]);
      expect(broadcast.size).toBe(handles.length - i - 1);
    }
  });
});
