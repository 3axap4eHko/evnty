import { createEvent, merge } from 'evnty';

// Creates a click event
const clickEvent = createEvent();
const handleClick = ({ button }) => console.log('Clicked button is', button);
const unsubscribeClick = clickEvent.on(handleClick);

// Creates a key press event
const keyPressEvent = createEvent();
const handleKeyPress = ({ key }) => console.log('Key pressed', key);
const unsubscribeKeyPress = keyPressEvent.on(handleKeyPress);

// Merges click and key press events into input event
const handleInput = (input) => console.log('Input', input);
const inputEvent = merge(clickEvent, keyPressEvent);
inputEvent.on(handleInput);

// One-time listener for left clicks only
clickEvent.once(({ button }) => {
  if (button === 'left') {
    console.log('First left click detected!');
  }
});

// Emit some events
keyPressEvent.emit({ key: 'W' });
keyPressEvent.emit({ key: 'A' });
keyPressEvent.emit({ key: 'S' });
keyPressEvent.emit({ key: 'D' });

clickEvent.emit({ button: 'right' });
clickEvent.emit({ button: 'left' });
clickEvent.emit({ button: 'middle' });

// Unsubscribe click listener
unsubscribeClick();

// Unsubscribe with a follow-up action
unsubscribeKeyPress();
console.log('Key press listener has been removed');
