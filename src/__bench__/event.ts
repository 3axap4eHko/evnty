import 'overtake';

const suite = benchmark('evnty benchmark', () => ({}));

const current = suite.target('current Event', async () => {
  const { Event } = await import('../../build/index.js');
  const event = new Event<void>();
  const events = new Event<void>();
  let i = 1000;
  while (i--) {
    events.on(() => {});
  }
  const gc: unknown[] = [];
  return { Event, gc, event, events };
});

current.measure('instantiation', ({ Event, gc }) => {
  gc.push(new Event());
});

current.measure('invoke', ({ event, gc }) => {
  gc.push(event());
});

current.measure('invokes', ({ events, gc }) => {
  gc.push(events());
});

const release = suite.target('release Event', async () => {
  const { Event } = await import('evnty');
  const event = new Event<void>();
  const events = new Event<void>();
  let i = 10000;
  while (i--) {
    events.on(() => {});
  }
  const gc: unknown[] = [];
  return { Event, gc, event, events };
});

release.measure('instantiation', ({ Event, gc }) => {
  gc.push(new Event());
});

release.measure('invoke', ({ event, gc }) => {
  gc.push(event());
});

release.measure('invokes', ({ events, gc }) => {
  gc.push(events());
});

