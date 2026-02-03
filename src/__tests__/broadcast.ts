import { Broadcast, ConsumerHandle } from '../broadcast';

declare const gc: () => void;

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

  it('should clean up via FinalizationRegistry when handle is garbage collected', async () => {
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

  it('should return true from emit when there are waiters', async () => {
    const broadcast = new Broadcast<number>();

    const promise = broadcast.receive();
    const result = broadcast.emit(42);

    expect(result).toBe(true);
    await promise;
  });

  it('should return false from emit when there are no waiters', () => {
    const broadcast = new Broadcast<number>();

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
    broadcast[Symbol.dispose]();
    expect(broadcast.disposed).toBe(true);
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

  it('should handle GC cleanup for multiple handles', async () => {
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

  it('should handle mixed manual and GC release', async () => {
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

  it('should not compact via GC when non-min consumer is collected', async () => {
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
    await expect(broadcast.receive()).rejects.toThrow('Broadcast disposed');
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

});
