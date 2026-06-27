<template>
  <div class="upload-section nes-field form-group upload-area">
    <label v-if="label">{{ label }}</label>

    <div class="preview-box" v-if="modelValue.file || canPreviewImage">
      <img :src="getAssetUrl(modelValue.existingUrl)" class="pixel-render" style="max-height: 100px; max-width: 100%;" v-if="canPreviewImage" />
      <span class="nes-text is-success" v-if="modelValue.file">已就绪: 待上传图片 (已压缩)</span>
      <span class="nes-text is-success" v-if="!modelValue.file && modelValue.existingUrl && !isUrl(modelValue.existingUrl)">已就绪: {{ modelValue.existingUrl }}</span>
    </div>

    <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*" style="display: none;" />
    <input type="file" ref="cameraInput" @change="handleFileSelect" accept="image/*" capture="environment" style="display: none;" />

    <div class="action-buttons" style="display: flex; gap: 10px; margin-bottom: 10px;">
      <button class="nes-btn is-success" style="flex: 1;" @click="() => fileInput.click()">📁 选图</button>
      <button class="nes-btn is-error" style="flex: 1;" @click="() => cameraInput.click()">📷 拍照</button>
    </div>
    <button class="nes-btn is-warning clip-btn" @click="handleClipboard">📋 读取剪贴板内容</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { compressImage, readClipboard } from '../utils/image'
import { isUrl, getAssetUrl } from '../utils/asset'

const props = defineProps({
  label: { type: String, default: '资源图片 / Emoji' },
  modelValue: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue'])

const canPreviewImage = computed(() => props.modelValue.existingUrl && isUrl(props.modelValue.existingUrl))

const fileInput = ref(null)
const cameraInput = ref(null)

const handleFileSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  const compressed = await compressImage(file)
  emit('update:modelValue', { file: compressed, existingUrl: '' })
  event.target.value = ''
}

const handleClipboard = () => {
  readClipboard(
    (compressedFile) => emit('update:modelValue', { file: compressedFile, existingUrl: '' }),
    (text) => emit('update:modelValue', { file: null, existingUrl: text })
  )
}
</script>

<style scoped>
.upload-area {
  border: 2px dashed #555;
  padding: 15px;
  background: #1a1a1a;
  margin-top: 10px;
}
.clip-btn {
  width: 100%;
  font-size: 12px;
}
.preview-box {
  margin-bottom: 10px;
  padding: 5px;
  background: #000;
  border: 1px solid #333;
}
</style>
