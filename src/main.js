import { isMobileDevice, showMobileNotice } from './mobileGate.js';

// Phones and tablets see the "app coming soon" notice; the game only loads on computers.
if (isMobileDevice()) showMobileNotice();
else await import('./app.js');
