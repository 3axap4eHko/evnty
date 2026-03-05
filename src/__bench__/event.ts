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
  return { Event, event, events };
});

current.measure('instantiation', ({ Event }) => {
  new Event();
});

current.measure('invoke', ({ event }) => {
  event.emit();
});

current.measure('invokes', ({ events }) => {
  events.emit();
});

const release = suite.target('release Event', async () => {
  const { Event } = await import('evnty-release');
  const event = new Event<void>();
  const events = new Event<void>();
  let i = 1000;
  while (i--) {
    events.on(() => {});
  }
  return { Event, event, events };
});

release.measure('instantiation', ({ Event }) => {
  new Event();
});

release.measure('invoke', ({ event }) => {
  event.emit();
});

release.measure('invokes', ({ events }) => {
  events.emit();
});

