import { API_BASE, ASSET_BASE } from './api'

/**
 * 判断字符串是否为可展示的 URL/资源路径
 * 支持：http 开头、后端静态资源 (/assets/)、文件扩展名
 */
export const isUrl = (str) =>
  str && typeof str === 'string' && (
    str.startsWith('http') ||
    str.startsWith('/assets') ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(str)
  )

/**
 * 将相对资源路径拼接为完整局域网 URL
 * emoji / 纯文本原样返回
 */
export const getAssetUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  if (url.startsWith('/assets')) return `${ASSET_BASE}${url}`
  return url
}
