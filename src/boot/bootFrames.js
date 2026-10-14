export const BCC_ASCII = [
  '  ██████╗  ██████╗ ██████╗ ',
  '  ██╔══██╗██╔════╝██╔════╝ ',
  '  ██████╔╝██║     ██║      ',
  '  ██╔══██╗██║     ██║      ',
  '  ██████╔╝╚██████╗╚██████╗ ',
  '  ╚═════╝  ╚═════╝ ╚═════╝ ',
];

export const BOOT_TIMING = {
  blankHold:       350,
  postCharDelay:   14,
  postLineDelay:   20,
  asciiCharDelay:  6,
  asciiLineDelay:  10,
  titleCharDelay:  30,
  subtitleDelay:   20,
  readyCharDelay:  12,
  finalPause:      700,
  quickBootDelay:  80,
};

export const POST_LINES = [
  { text: 'BCC SYSTEMS — BIOS v4.2.1', className: 'bright' },
  { text: '──────────────────────────────────────────', className: '' },
  { text: 'MÉMOIRE PRINCIPALE.............', className: '', suffix: 'OK' },
  { text: 'PROCESSEUR CRYPTOGRAPHIQUE.....', className: '', suffix: 'OK' },
  { text: 'INTERFACE RÉSEAU...............', className: '', suffix: 'OK' },
  { text: 'MODULE AUTH — CLEARANCE........', className: '', suffix: 'OK' },
  { text: 'ARCHIVES BCC...................', className: '', suffix: 'OK' },
  { text: '──────────────────────────────────────────', className: '' },
];

export const READY_LINES = [
  { text: 'CONNEXION AU MAINFRAME BCC...', className: '' },
  { text: 'SERVICE D\'AUTHENTIFICATION : EN LIGNE', className: '' },
  { text: '──────────────────────────────────────────', className: '' },
  { text: 'TAPEZ "help" POUR LA LISTE DES COMMANDES', className: 'bright' },
];

export const QUICK_BOOT_LINES = [
  { text: 'BCC TERMINAL — SESSION REPRISE', className: 'bright' },
  { text: 'SYSTÈME EN LIGNE', className: '' },
  { text: '──────────────────────────────────────────', className: '' },
];
