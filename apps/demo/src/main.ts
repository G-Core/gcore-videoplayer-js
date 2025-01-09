import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { Logger, LogTracer, setTracer } from '@gcorevideo/player'
import { setTracer as setTracerPlugins } from '@gcorevideo/player-plugins'

import App from './App.vue'
import router from './router'

const logger = new LogTracer("gplayer-demo");
setTracer(logger);
setTracerPlugins(logger);
Logger.enable("*");

const app = createApp(App)

app.use(router)

const pinia = createPinia();
app.use(pinia)

app.mount('#app')
