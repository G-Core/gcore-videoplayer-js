import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import { Logger, LogTracer, setTracer } from '@gcorevideo/player'

setTracer(new LogTracer("gplayer-demo"));
Logger.enable("*");

// TOOD init Sentry

const app = createApp(App)

app.use(router)

app.mount('#app')
