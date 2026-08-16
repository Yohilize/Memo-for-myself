import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia, useFixedBackgroundStore } from './stores'
import './styles/global.css'

const app = createApp(App)
app.use(pinia)

// 启动时从 IndexedDB 加载固定背景（壁纸 + 8 个背景参数）。
// 加载顺序：
//   1. Pinia 先安装（上面 app.use(pinia)）
//   2. fixedBackgroundStore.load() 从 Dexie 读单条 KV，写入响应式值
//   3. BackgroundLayer（App.vue 中第一渲染的子组件）立即订阅响应式值
//      → 在 initialized=true 前先用默认值渲染（避免闪一下纯黑），
//        数据就位后自动更新（因为 Pinia 响应式 + computed style）
void useFixedBackgroundStore().load()

app.use(router)
app.mount('#app')
