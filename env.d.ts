/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/* 第三方库无类型声明：保持最小化、不引入 @types/* 臃肿依赖 */
declare module 'vue-cal' {
  import type { DefineComponent } from 'vue'
  const VueCal: DefineComponent<
    {
      events?: any[]
      activeDate?: Date | string
      selectedDate?: Date | string
      view?: string
      locale?: any
      hideSideBar?: boolean
      disableEventsDrag?: boolean
      disableEventsOverlap?: boolean
    },
    {},
    any
  >
  export default VueCal
}

declare module 'vue-cal/dist/i18n/zh-cn.es.js' {
  const zhCn: any
  export default zhCn
}
declare module 'vue-cal/dist/i18n/*.es.js' {
  const locale: any
  export default locale
}
