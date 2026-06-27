import { ref } from 'vue'

export const toastMessage = ref('')
let toastTimer = null

export const showToast = (msg) => {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 1000)
}