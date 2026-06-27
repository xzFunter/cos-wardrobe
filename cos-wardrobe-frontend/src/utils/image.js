import { showToast } from './toast'

/**
 * 压缩图片至指定大小（默认 1MB），超出时缩放至 1024px 并转 JPEG
 * @param {File} file 原始文件
 * @param {number} maxSizeMB 最大文件大小(MB)
 * @returns {Promise<File>} 压缩后的文件
 */
export const compressImage = (file, maxSizeMB = 1) => {
  return new Promise((resolve) => {
    if (file.size <= maxSizeMB * 1024 * 1024) return resolve(file)
    showToast('⏳ 图片较大，正在施放压缩魔法...')
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > 1024 || height > 1024) {
          const ratio = Math.min(1024 / width, 1024 / height)
          width *= ratio
          height *= ratio
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
          })
          resolve(compressedFile)
        }, 'image/jpeg', 0.8)
      }
    }
  })
}

/**
 * 从剪贴板读取图片或文本（EMOJI）
 * 成功时调用对应回调：
 * - onImage(file) 捕获到图片并压缩后
 * - onText(text) 捕获到文本
 * @param {function} onImage 图片回调
 * @param {function} onText 文本回调
 */
export const readClipboard = async (onImage, onText) => {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      if (item.types.some(t => t.startsWith('image/'))) {
        const imageType = item.types.find(t => t.startsWith('image/'))
        const blob = await item.getType(imageType)
        const originalFile = new File([blob], 'clipboard_image.png', { type: blob.type })
        const compressed = await compressImage(originalFile)
        onImage(compressed)
        return
      }
      if (item.types.includes('text/plain')) {
        const blob = await item.getType('text/plain')
        const text = await blob.text()
        onText(text.trim())
        return
      }
    }
    showToast('⚠️ 剪贴板里似乎没有我能认出的东西。')
  } catch (err) {
    showToast('❌ 无法读取，请检查浏览器是否允许访问剪贴板。')
  }
}
