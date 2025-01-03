<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

import '@gcorevideo/player/dist/index.css'
import '@gcorevideo/player-plugins/dist/index.css'

import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <header>
    <img alt="Gcore logo" class="logo" src="@/assets/gcore_orange_001.svg" width="125" height="125" />

    <div class="wrapper">
      <HelloWorld msg="Gcore video player" />

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>

  <main>
    <RouterView />
  </main>

  <footer>
    <a href="https://dashjs.org" target="_blank" rel="noopener noreferrer" title="DASH.js">
      DASH.js
    </a>
    <a href="https://hlsjs.video-dev.org/demo/" target="_blank" rel="noopener noreferrer" title="HLS.js">
      HLS.js
    </a>
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

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
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

footer {
  display: flex;
  place-items: center;
  justify-content: center;
  padding: 1rem 0 0 0;
  gap: 1rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
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
