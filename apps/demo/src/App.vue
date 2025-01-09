<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

import '@gcorevideo/player/dist/index.css'
import '@gcorevideo/player-plugins/dist/index.css'
import { version } from '@gcorevideo/player'
import * as pkg from '../package.json' with { "type": "json" }

const ver = version()

</script>

<template>
  <header>
    <div class="wrapper">
      <img alt="Gcore logo" class="logo" src="@/assets/gcore_orange_001.svg" width="40" height="40" />
      <h1>Gcore video player</h1>
    </div>
    <nav>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/settings">Settings</RouterLink>
      <RouterLink to="/source">Source</RouterLink>
    </nav>
  </header>

  <main>
    <RouterView />
  </main>

  <footer>
    <div class="links">
      <a href="https://dashjs.org" target="_blank" rel="noopener noreferrer" title="DASH.js">
        DASH.js
      </a>
      <a href="https://hlsjs.video-dev.org/demo/" target="_blank" rel="noopener noreferrer" title="HLS.js">
        HLS.js
      </a>
    </div>
    <div class="version">
      {{ pkg.version }}/gplayer {{ ver.gplayer }}/clappr {{ ver.clappr }}
    </div>
  </footer>
</template>

<style scoped>
:root {
  --footer-height: 30px;
}

header {
  line-height: 1.5;
  height: var(--footer-height);
  padding-top: 1rem;
  box-sizing: border-box;
}

header,
header .wrapper {
  align-items: center;
  place-items: center;
}

header .wrapper {
  display: flex;
  gap: 0.5rem;
}

h1 {
  text-align: center;
}

.logo {
  display: block;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 1rem;
  margin-bottom: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

main {
  flex: 100% 1 1;
}

footer {
  display: flex;
  place-items: center;
  justify-content: space-between;
  ;
  padding: 1rem 0 0 0;
  gap: 1rem;
}

footer .version {
  font-size: 0.8rem;
}

footer b {
  font-weight: 600;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  h1 {
    text-align: left;
  }

  .logo {
    margin: 0 2rem 0 0;
    width: 125px;
    height: 125px;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start center;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
    margin-bottom: 0;
  }

  main {
    min-height: calc(var(--view-height) - var(--footer-height));
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  footer {
    grid-column-start: 1;
    grid-column-end: 3;
  }
}
</style>
