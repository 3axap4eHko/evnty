import 'overtake';

const suite = benchmark('evnty benchmark', () => ({}));

const evnty = suite.target('current Event', async () => {
  const { Event } = await import('../../build/index.js');
  const event = new Event<void>();
  const events = new Event<void>();
  let i = 1000;
  while (i--) {
    events.on(() => {});
  }
  return { Event, event, events };
});

evnty.measure('instantiation', ({ Event }) => {
  new Event();
});

evnty.measure('invoke', ({ event }) => {
  event.emit();
});

evnty.measure('invokes', ({ events }) => {
  events.emit();
});

