<template>
  <div class="office-container">
    <div class="nes-container is-dark with-title office-main">
      <p class="title">酒馆办公室 (设置中心)</p>

      <div class="header-tools"
        style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">

        <div class="tabs-group" style="display: flex; gap: 10px;">
          <button class="nes-btn" :class="{ 'is-primary': activeTab === 'models' }"
            @click="switchTab('models')">模特模板设置</button>
          <button class="nes-btn" :class="{ 'is-primary': activeTab === 'components' }"
            @click="switchTab('components')">组件字典设置</button>
        </div>

        <div class="sort-group" v-if="currentList.length > 0">
          <button :class="['nes-btn', isSorting ? 'is-warning' : 'is-primary']" @click="handleToggleSort"
            style="font-size: 12px; padding: 4px 8px;">
            {{ isSorting ? '💾 完成保存' : '⚔️ 调整顺序' }}
          </button>
        </div>
      </div>

      <div class="grid-area hide-scrollbar" :class="{ 'sorting-fever': isSorting }">

        <div v-for="(item, index) in currentList" :key="item.id" class="item-card-wrapper"
          :style="{ transform: shiftedCards[item.id] ? `translateX(${shiftedCards[item.id]})` : 'none' }"
          :class="{ 'is-shifted': !!shiftedCards[item.id] }">

          <div class="nes-container is-rounded is-dark item-card" @click="handleItemClick(item)">
            <i v-if="item.is_system" class="system-badge nes-icon star is-small"></i>
            <div v-if="item.type" class="type-badge nes-text is-warning">[{{ item.type }}]</div>

            <img v-if="isUrl(item.image_url || item.icon_url)" :src="getAssetUrl(item.image_url || item.icon_url)"
              class="item-image pixel-render" />
            <div v-else class="emoji-icon">{{ item.image_url || item.icon_url }}</div>

            <p class="item-name">{{ item.name }}</p>
            <div class="sort-controller" v-if="isSorting" @click.stop>
              <button class="nes-btn is-error sort-btn" :disabled="index === 0"
                @click="handleMoveItem(index, 'prev')">◀</button>
              <span style="font-size: 10px; color:#ffd700;">{{ index + 1 }}</span>
              <button class="nes-btn is-success sort-btn" :disabled="index === currentList.length - 1"
                @click="handleMoveItem(index, 'next')">▶</button>
            </div>
          </div>

          <div v-if="cardStatuses[index]?.isFirst"
            :class="['gap-insert-anchor', 'is-left', { 'is-expanded': expandedGap === `${item.id}-left` }]"
            @mouseenter="handleGapMouseEnter(item.id, 'left')" @mouseleave="handleGapMouseLeave"
            @click.stop="handleGapClick(item.id, 'left', onGapConfirm)">
            <div class="gap-plus-btn">＋</div>
          </div>

          <div :class="['gap-insert-anchor', 'is-right', { 'is-expanded': expandedGap === `${item.id}-right` }]"
            @mouseenter="handleGapMouseEnter(item.id, 'right')" @mouseleave="handleGapMouseLeave"
            @click.stop="handleGapClick(item.id, 'right', onGapConfirm)">
            <div class="gap-plus-btn">＋</div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showModal">
      <div class="nes-dialog is-dark modal-box">
        <p class="title" style="margin-bottom: 20px; font-size: 20px;">
          {{ isEditMode ? '重铸 / 销毁' : '锻造新' }}{{ activeTab === 'models' ? '模特' : '组件' }}
        </p>

        <div class="nes-field form-group">
          <label>名称</label>
          <input type="text" class="nes-input is-dark" v-model="formData.name" placeholder="输入名称...">
        </div>

                <div class="nes-field form-group" v-if="activeTab === 'components'">
                    <label>组件部位</label>
                    <div class="nes-select is-dark">
                        <select v-model="formData.type" :disabled="isEditMode">
                            <option value="" disabled selected hidden>请选择部位...</option>
                            <option v-for="type in componentTypes" :key="type" :value="type">{{ type }}</option>
                        </select>
                    </div>
                    <p v-if="isEditMode" class="nes-text is-warning" style="font-size: 10px; margin-top: 4px;">
                        ⚠️ 部位类型创建后不可更改
                    </p>
                </div>

        <UploadSection label="资源图片 / Emoji" :modelValue="formData" @update:modelValue="onUploadUpdate" />

        <div class="dialog-menu">
          <button v-if="isEditMode && activeTab === 'components'" class="nes-btn is-error delete-btn"
            @click="deleteItem">销毁</button>
          <div style="margin-left:auto; display:flex; gap: 15px;">
            <button class="nes-btn" @click="showModal = false">取消</button>
            <button class="nes-btn is-primary" @click="submitForm">{{ isEditMode ? '保存重铸' : '确认锻造' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { showToast } from '../utils/toast'
import { API_BASE, ASSET_BASE } from '../utils/api'
import { isUrl, getAssetUrl } from '../utils/asset'
import UploadSection from '../components/UploadSection.vue'
import { useGapInsert } from '../composables/useGapInsert'

const router = useRouter()

// === 数据源状态 ===
const activeTab = ref('models')
const modelsList = ref([])
const componentsList = ref([])
const componentTypes = ref([])

const showModal = ref(false)
const isEditMode = ref(false)
const formData = ref({ id: null, name: '', type: '', file: null, existingUrl: '', insertBefore: null, insertAfter: null })

// === 缝隙插入微交互 (composable) ===
const currentList = computed(() => activeTab.value === 'models' ? modelsList.value : componentsList.value)

const fetchData = async () => {
  const [modelsRes, compsRes] = await Promise.all([
    axios.get(`${API_BASE}/models`),
    axios.get(`${API_BASE}/components`)
  ])
  modelsList.value = modelsRes.data
  componentsList.value = compsRes.data
}

const getTableName = () => activeTab.value === 'models' ? 'model_templates' : 'component_templates'

const {
    isSorting, expandedGap, shiftedCards, cardStatuses,
    updateRowStatuses, collapseGap,
    handleGapMouseEnter, handleGapMouseLeave, handleGapClick,
    moveItem, toggleSortingMode, initResizeObserver, destroy
} = useGapInsert({
    getCurrentList: () => currentList.value,
    tableName: getTableName(), // composable 初始化时传，切 tab 后 toggleSortingMode 里会重新取
    fetchData,
    gridSelector: '.grid-area',
    wrapperSelector: '.item-card-wrapper'
})

onMounted(async () => {
  try {
    const configRes = await axios.get(`${API_BASE}/system-config`)
    componentTypes.value = configRes.data.enums.component_types
    await fetchData()
    document.addEventListener('click', collapseGap)
    initResizeObserver()
  } catch (error) {
    showToast('❌ 无法连接到服务器！')
  }
})

watch(currentList, async () => {
  await nextTick()
  updateRowStatuses()
})

const switchTab = async (tab) => {
  activeTab.value = tab
  isSorting.value = false
  collapseGap()
  await nextTick()
  updateRowStatuses()
}

const openAddModal = (gapConfig = null) => {
  isEditMode.value = false
  formData.value = {
    id: null, name: '', type: '', file: null, existingUrl: '',
    insertBefore: gapConfig?.side === 'left' ? gapConfig.id : null,
    insertAfter: gapConfig?.side === 'right' ? gapConfig.id : null
  }
  showModal.value = true
}

const onGapConfirm = (gapConfig) => {
  openAddModal(gapConfig)
}

const onUploadUpdate = (val) => {
  Object.assign(formData.value, val)
}

const handleItemClick = (item) => {
  if (isSorting.value) return
  if (activeTab.value === 'models') {
    router.push(`/app/model-setup/${item.id}`)
    return
  }
  if (item.is_system) {
    showToast('⚠️ 世界法则保护：系统内置组件无法修改！')
    return
  }
  isEditMode.value = true
  formData.value = { id: item.id, name: item.name, type: item.type, file: null, existingUrl: item.icon_url, insertBefore: null, insertAfter: null }
  showModal.value = true
}

// 🌟 覆盖 composable 的排序存储——Office 的 tableName 随 activeTab 动态切换
const handleToggleSort = async () => {
  if (!isSorting.value) {
    isSorting.value = true
    showToast('🧙‍♂️ 开启整队模式')
  } else {
    try {
      const idList = currentList.value.map(item => item.id)
      const table = activeTab.value === 'models' ? 'model_templates' : 'component_templates'
      await axios.post(`${API_BASE}/save-order`, { table, idList })
      isSorting.value = false
      showToast('✨ 序列已安全存档！')
      await fetchData()
    } catch (err) {
      showToast('❌ 保存失败')
    }
  }
}

const handleMoveItem = (index, direction) => {
  const list = activeTab.value === 'models' ? modelsList.value : componentsList.value
  const targetIndex = direction === 'prev' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= list.length) return
  ;[list[index], list[targetIndex]] = [list[targetIndex], list[index]]
}

// === 表单提交 ===
const submitForm = async () => {
  if (!formData.value.name) return showToast('❌ 必须有名字！')
  if (activeTab.value === 'components' && !formData.value.type) return showToast('❌ 请选择组件部位！')

  let finalIconUrl = formData.value.existingUrl || (activeTab.value === 'models' ? '👤' : '❓')
  if (formData.value.file) {
    try {
      const fileData = new FormData()
      fileData.append('file', formData.value.file)
      const uploadRes = await axios.post(`${API_BASE}/upload?target=${activeTab.value}`, fileData)
      finalIconUrl = uploadRes.data.url
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '上传失败'
      return showToast(`❌ ${msg}`)
    }
  }

  const path = activeTab.value === 'models' ? 'models' : 'components'
  const endpoint = `${API_BASE}/${path}`

  const payload = activeTab.value === 'models'
    ? { name: formData.value.name, image_url: finalIconUrl }
    : { name: formData.value.name, type: formData.value.type, icon_url: finalIconUrl }

  if (!isEditMode.value) {
    if (formData.value.insertAfter) payload.insert_after_id = formData.value.insertAfter
    if (formData.value.insertBefore) payload.insert_before_id = formData.value.insertBefore
  }

  try {
    if (isEditMode.value) {
      await axios.put(`${endpoint}/${formData.value.id}`, payload)
      showToast('✨ 重铸成功！')
    } else {
      await axios.post(endpoint, payload)
      showToast('🔨 锻造成功！')
    }
    showModal.value = false
    await fetchData()
  } catch (err) {
    showToast('❌ 操作失败，请检查网络！')
  }
}

const deleteItem = async () => {
  if (!confirm('⚠️ 确认要永久销毁此模具吗？')) return
  try {
    await axios.delete(`${API_BASE}/components/${formData.value.id}`)
    showToast('🗑️ 模具已被彻底销毁！')
    showModal.value = false
    await fetchData()
  } catch (error) {
    showToast('❌ 销毁失败。')
  }
}
</script>

<style scoped>
.office-container {
  height: 100%;
  position: relative;
}
.office-main {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.tabs {
  display: flex;
  gap: 15px;
}

.grid-area {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  overflow-y: auto;
  overflow-x: visible;
  padding-bottom: 20px;
  padding-left: 15px;
  padding-right: 15px;
}

.item-card-wrapper {
  position: relative;
  width: 100%;
  transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 1;
}
.item-card-wrapper.is-shifted {
  z-index: 10;
}

.item-card {
  margin: 0 !important;
  width: 100%;
  height: 200px;
  background-color: #2a2a2a;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  padding: 0 !important;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 2px solid #555;
  transition: transform 0.1s, border-color 0.1s;
}
.item-card:hover {
  border-color: #ffd700;
}

.add-card .item-name {
  background: transparent;
  bottom: 20px;
}
.type-badge {
  position: absolute;
  top: 0;
  left: 0;
  background: #000;
  padding: 2px 6px;
  font-size: 10px;
  border-bottom: 1px solid #fff;
  border-right: 1px solid #fff;
  z-index: 10;
}
.system-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 10;
}
.cover-placeholder {
  z-index: 1;
  font-size: 40px;
}

.item-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 5px;
  box-sizing: border-box;
  z-index: 1;
}
.emoji-icon {
  font-size: 80px;
  z-index: 1;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.item-name {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  margin: 0;
  padding: 6px 4px;
  color: #fff;
  font-size: 12px;
  text-align: center;
  z-index: 5;
  background: rgba(0, 0, 0, 0.25);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 缝隙让位锚点 */
.gap-insert-anchor {
  position: absolute;
  top: 0;
  width: 15px;
  height: 100%;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.gap-insert-anchor.is-right {
  right: -15px;
}
.gap-insert-anchor.is-left {
  left: -15px;
}

.gap-plus-btn {
  background: #ffd700;
  color: #000;
  border: 1px solid #fff;
  font-size: 10px;
  font-weight: bold;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 5px #ffd700;
  transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.gap-insert-anchor.is-expanded {
  opacity: 1 !important;
  width: 70px;
}
.gap-insert-anchor.is-right.is-expanded {
  right: -70px;
}
.gap-insert-anchor.is-left.is-expanded {
  left: -70px;
}
.gap-insert-anchor.is-expanded .gap-plus-btn {
  width: 44px;
  height: 44px;
  font-size: 30px;
  border-radius: 50%;
  background: #4cd964;
  box-shadow: 0 0 15px rgba(76, 217, 100, 0.8);
}

@media (min-width: 769px) {
  .item-card-wrapper:hover .gap-insert-anchor:not(.is-expanded) {
    opacity: 0.6;
  }
}
.sorting-fever .gap-insert-anchor:not(.is-expanded) {
  opacity: 0.6;
}

.sorting-fever .item-card:not(.add-card) {
  animation: pixelShake 0.6s infinite alternate ease-in-out;
  border-color: #ff0055;
}
@keyframes pixelShake {
  0% {
    transform: rotate(-0.5deg);
  }
  100% {
    transform: rotate(0.5deg);
  }
}

.sort-controller {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.75);
  z-index: 12;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 10px;
  box-sizing: border-box;
}
.sort-btn {
  padding: 2px 6px !important;
  font-size: 10px !important;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(3px);
}
.modal-box {
  width: 450px;
  background-color: #212529;
  border: 4px solid #fff;
  padding: 30px;
}
.form-group {
  margin-bottom: 20px;
}
.upload-area {
  border: 2px dashed #555;
  padding: 15px;
  background: #1a1a1a;
  margin-top: 10px;
}
.file-input {
  display: block;
  width: 100%;
  background: #000;
  padding: 10px;
  border: 2px solid #555;
  color: #fff;
  margin-bottom: 15px;
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
.dialog-menu {
  display: flex;
  margin-top: 30px;
  align-items: center;
}
.header-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  /* 如果空间不足，允许换行，但通过 flex 保证紧凑 */
  gap: 10px;
}

.tabs-group {
  display: flex;
  gap: 8px;
  border: 3px solid #ffffff;
}

@media (max-width: 768px) {
  /* 🌟 核心：强制横向排列，不允许换行 🌟 */
  .header-tools {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    /* 控制三个按钮之间的整体间隙 */
  }

  .tabs-group .nes-btn {
    font-size: 10px !important;
    padding: 6px 4px !important;
    white-space: nowrap;
    flex: 1;
    /* 让两个 tab 均分空间 */
  }

  .sort-group .nes-btn {
    font-size: 10px !important;
    padding: 6px 8px !important;
  }

  .grid-area {
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding: 10px;
    width: 100%;
    padding-left: 15px;
    padding-right: 15px;
  }
  .office-main {
    padding: 10px;
  }

  .gap-insert-anchor {
    width: 10px;
  }
  .gap-insert-anchor.is-right {
    right: -10px;
  }
  .gap-insert-anchor.is-left {
    left: -10px;
  }
  .item-card-wrapper.is-shifted {
    transform: translateX(50px);
  }
  .gap-insert-anchor.is-expanded {
    width: 60px;
  }
  .gap-insert-anchor.is-right.is-expanded {
    right: -60px;
  }
  .gap-insert-anchor.is-left.is-expanded {
    left: -60px;
  }

  .modal-box {
    width: 90vw !important;
    max-width: 450px;
    padding: 15px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .dialog-menu {
    flex-direction: column;
    gap: 10px;
  }
  .dialog-menu > div {
    width: 100%;
    justify-content: space-between;
  }
  .dialog-menu .nes-btn {
    font-size: 12px;
    padding: 6px 10px;
  }
  .nes-field {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>