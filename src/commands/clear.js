export default {
  name: 'clear',
  description: 'Effacer l\'écran terminal',
  usage: 'clear',
  secret: false,
  handler(_args, { outputRenderer }) {
    outputRenderer.clear();
  },
};
