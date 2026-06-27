import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 引入路由

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import './style.css'

createApp(App).use(router).mount('#app') // 使用路由