Project is divident into separate packages:

* player - the player package -> https://www.npmjs.com/package/@gcorevideo/videoplayer
* utils - resusable utilities -> https://www.npmjs.com/package/@gcorevideo/utils
  The utils are used in the Gcore videoplayer and WebRTC client, and might be used by the client apps

Project root dependencies specify common development tools: oxlint, prettier, husky, and license-checker.
They are used in pre-commit hooks.
