<template>
  <div class="forge-container hide-scrollbar">
    <div class="nes-container is-dark with-title forge-main">
      <p class="title">{{ costumeId ? '重铸套装 (编辑)' : '锻造工坊 (新增)' }}</p>

      <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*" style="display: none;" />
      <input type="file" ref="cameraInput" @change="handleFileSelect" accept="image/*" capture="environment"
        style="display: none;" />

      <div class="form-layout">
        <div class="basic-info nes-container is-rounded is-dark">

          <div class="nes-field form-group upload-area">
            <label>封面图片 / Emoji</label>

            <div class="preview-box" v-if="formData.coverFile || formData.coverPreview">
              <img v-if="!formData.coverFile && isUrl(formData.coverPreview)" :src="getAssetUrl(formData.coverPreview)"
                class="pixel-render object-cover" style="max-height: 150px; width: 100%; margin-bottom: 10px;" />
              <span v-else class="nes-text is-success">已就绪: {{ formData.coverFile ? '待上传图片 (已压缩)' :
                formData.coverPreview }}</span>
            </div>

            <div class="action-buttons" style="display: flex; gap: 10px; margin-bottom: 10px;">
              <button class="nes-btn is-success" style="flex: 1;" @click="triggerUpload('cover', 'file')">📁 选图</button>
              <button class="nes-btn is-error" style="flex: 1;" @click="triggerUpload('cover', 'camera')">📷 拍照</button>
            </div>
            <button class="nes-btn is-warning clip-btn" @click="readClipboard('cover')">
              📋 读取剪贴板内容
            </button>
          </div>

          <div class="nes-field form-group">
            <label>套装名称 <span class="required">*</span></label>
            <input type="text" class="nes-input is-dark" v-model="formData.name" placeholder="例如: 苍翠游侠套装">
          </div>

          <div class="nes-field form-group common-box-search-field">
            <label>作品来源 (可选)</label>
            <input type="text" class="nes-input is-dark" v-model="formData.origin" @focus="showOriginDropdown = true"
              @blur="hideOriginDropdownWithDelay" placeholder="例如: 塞尔达传说">

            <!-- 🌟 新增：作品来源的悬浮联想结果面板 🌟 -->
            <div v-if="showOriginDropdown" class="common-comp-dropdown nes-container is-dark">
              <ul class="dropdown-ul">
                <!-- 如果是新作品，将其置顶并标记“新增作品” -->
                <li v-if="isNewOrigin && formData.origin" @mousedown="selectOrigin(formData.origin)"
                  class="dropdown-li nes-text is-warning" style="border-bottom: 2px dashed #ff9800; font-weight: bold;">
                  ✨ {{ formData.origin }} (新增作品)
                </li>

                <!-- 渲染模糊匹配到的已有作品 -->
                <li v-for="item in filteredOrigins" :key="item.id" @mousedown="selectOrigin(item.name)"
                  class="dropdown-li">
                  {{ item.name }}
                </li>

                <!-- 空数据兜底 -->
                <li v-if="filteredOrigins.length === 0 && !formData.origin" class="dropdown-li nes-text is-disabled">
                  暂无已有作品，请直接输入新增
                </li>
              </ul>
            </div>
          </div>

          <div class="nes-field form-group">
            <label>绑定模特蓝图 <span class="required">*</span></label>
            <div class="nes-select is-dark">
              <select v-model="formData.model_id" @change="handleModelChange">
                <option value="" disabled selected hidden>请选择一个模特蓝图...</option>
                <option v-for="model in modelsList" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="components-info nes-container is-rounded is-dark" v-if="formData.model_id">
          <p style="color: #ffd700; margin-bottom: 15px; border-bottom: 2px dashed #555; padding-bottom: 10px;">
            模具组件装配情况 ({{ activeCount }} / {{ costumeComponents.length }})
          </p>

          <div v-if="costumeComponents.length === 0" class="nes-text is-disabled">
            该模特蓝图上尚未挂载任何组件。请先前往【蓝图工作室】配置。
          </div>

          <div class="component-grid">
            <div v-for="(comp, index) in costumeComponents" :key="comp.nodeId"
              :class="['comp-card', { 'is-active': comp.isActive }]">

              <label class="activation-toggle">
                <input type="checkbox" class="nes-checkbox is-dark" v-model="comp.isActive">
                <span>激活此部位</span>
              </label>

              <div class="comp-header" :style="{ opacity: comp.isActive ? 1 : 0.3 }">
                <div class="comp-icon">
                  <img v-if="isUrl(comp.icon)" :src="getAssetUrl(comp.icon)" class="pixel-render object-cover" />
                  <span v-else class="emoji-large">{{ comp.icon }}</span>
                </div>
                <div class="comp-name-box">
                  <span class="nes-text is-warning" style="font-size:10px">[{{ comp.type }}]</span>
                  <div class="comp-name">{{ comp.label }}</div>
                </div>
              </div>

              <div class="comp-actions" v-if="comp.isActive">

                <label class="owned-toggle" v-if="!comp.common_component_id">
                  <input type="checkbox" class="nes-checkbox is-dark" v-model="comp.isOwned">
                  <span :class="comp.isOwned ? 'nes-text is-success' : 'nes-text is-error'">
                    {{ comp.isOwned ? '已入库 (拥有)' : '未入库 (待补)' }}
                  </span>
                </label>

                <div class="nes-field common-box-search-field">
                  <label style="font-size: 11px; color: #00ff66; display: block; margin-bottom: 2px;">🧰 使用通用组件
                    (百宝箱)</label>

                  <input type="text" class="nes-input is-dark mini-search-input" v-model="comp.searchQuery"
                    @focus="comp.showDropdown = true" @blur="hideDropdownWithDelay(index)"
                    @input="handleSearchInput(index)" placeholder="🔍 输入或点击下方联想资产..."
                    style="font-size: 10px; padding: 4px; width: 100%;" />

                  <div v-if="comp.showDropdown && getFilteredCommonComponents(comp).length > 0"
                    class="common-comp-dropdown nes-container is-dark">
                    <ul class="dropdown-ul">
                      <li v-for="item in getFilteredCommonComponents(comp)" :key="item.id"
                        @mousedown="selectCommonComponent(index, item)" class="dropdown-li">
                        {{ item.name }}
                      </li>
                    </ul>
                  </div>
                </div>

                <div class="upload-area inline-mini-upload" v-if="!comp.common_component_id">
                  <label style="font-size: 12px; margin-bottom: 5px;">实物照片 / Emoji</label>

                  <div class="preview-box mini-preview" v-if="comp.realFile || (comp.realPreview && isUrl(comp.realPreview))">
                    <img v-if="!comp.realFile && isUrl(comp.realPreview)" :src="getAssetUrl(comp.realPreview)" class="pixel-render object-cover" />
                    <span v-if="!comp.realFile && comp.realPreview && !isUrl(comp.realPreview)" class="nes-text is-success" style="font-size: 10px;">已就绪: {{ comp.realPreview }}</span>
                    <span v-if="comp.realFile" class="nes-text is-success" style="font-size: 10px;">已就绪: 待上传照片</span>
                  </div>

                  <div class="action-buttons" style="display: flex; gap: 5px; margin-bottom: 5px;">
                    <button class="nes-btn is-success mini-btn" @click="triggerUpload(index, 'file')">📁 选图</button>
                    <button class="nes-btn is-error mini-btn" @click="triggerUpload(index, 'camera')">📷 拍照</button>
                  </div>
                  <button class="nes-btn is-warning clip-btn mini-btn" @click="readClipboard(index)">
                    📋 读取剪贴板
                  </button>
                </div>

                <div class="common-linked-tip nes-container is-rounded" v-else>
                  <span class="nes-text is-success" style="font-size: 9px; display: block; line-height: 1.3;">
                    🔗 已锁定共享资产！默认状态更改为【一定拥有】，相关图源将热同步。
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div class="action-footer">
        <button class="nes-btn" @click="goBack">取消退回</button>
        <button class="nes-btn is-primary" @click="saveCostume" :disabled="isSaving">
          {{ isSaving ? '锻造中...' : '💾 保存套装' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isUrl, getAssetUrl } from '../utils/asset'
import axios from 'axios'
import { showToast } from '../utils/toast'
import { API_BASE, ASSET_BASE } from '../utils/api'

const route = useRoute()
const router = useRouter()
const costumeId = route.params.id || null
const insertAfterId = route.query.insertAfter || null
const insertBeforeId = route.query.insertBefore || null

const userId = localStorage.getItem('currentUserId')

const isSaving = ref(false)
const modelsList = ref([])
const commonComponentsList = ref([])

const originsList = ref([]) // 存储从数据库拉取的作品源列表
const showOriginDropdown = ref(false) // 控制作品下拉框显示

const formData = ref({
  name: '',
  origin: '',
  model_id: '',
  coverFile: null,
  coverPreview: '',
})

const costumeComponents = ref([])
const activeCount = computed(() => costumeComponents.value.filter(c => c.isActive).length)

// Forge 使用共享的 isUrl/getAssetUrl (来自 ../utils/asset)
// 本地保留 compressImage 和 readClipboard 因为 Forge 有其特殊封装逻辑

// === 数据初始化 ===
onMounted(async () => {
  if (!userId) return router.push('/')

  try {

    // 1. 并发请求基础数据（含组件字典用于实时同步）
    const [modelsRes, compRes, commonRes, originsRes] = await Promise.all([
      axios.get(`${API_BASE}/models`),
      axios.get(`${API_BASE}/components`),
      axios.get(`${API_BASE}/common-components`),
      axios.get(`${API_BASE}/origins`)
    ])

    modelsList.value = modelsRes.data
    commonComponentsList.value = commonRes.data
    originsList.value = originsRes.data
    const componentTemplatesMap = new Map(compRes.data.map(c => [c.id, c]))

    // 2. 编辑模式下加载套装详情
    if (costumeId) {
      const cosRes = await axios.get(`${API_BASE}/costumes/${costumeId}`)
      const cos = cosRes.data
      formData.value.name = cos.name
      formData.value.origin = cos.origin
      formData.value.model_id = cos.model_id
      formData.value.coverPreview = cos.cover_url || ''

      // 用模特最新的蓝图节点作为基准，再合并套装快照的状态
      if (cos.model_id) {
        try {
          const modelRes = await axios.get(`${API_BASE}/models/${cos.model_id}`)
          const model = modelRes.data
          if (model.layout_data) {
            const graph = JSON.parse(model.layout_data)
            const blueprintNodes = (graph.nodes || []).filter(n => n.type === 'component')

            // 从套装快照中解析已有状态 (nodeId → savedState)
            const savedStateMap = new Map()
            if (cos.components_data) {
              try {
                const savedComps = JSON.parse(cos.components_data)
                savedComps.forEach(c => { savedStateMap.set(c.nodeId, c) })
              } catch (e) { /* ignore */ }
            }

            // 以模特最新蓝图为基准，合并套装快照中的状态
            costumeComponents.value = blueprintNodes.map(node => {
              const compId = node.data.componentId
              const saved = savedStateMap.get(node.id)
              const template = componentTemplatesMap.get(compId)
              const baseLabel = template ? template.name : node.label
              const baseType = template ? template.type : node.data.type
              const baseIcon = template ? template.icon_url : node.data.icon

              if (saved) {
                // 已有状态：保留激活/拥有/通用绑定等
                let initialSearch = ''
                let actualRealPreview = saved.realPreview || ''
                if (saved.common_component_id) {
                  const matched = commonComponentsList.value.find(g => g.id === saved.common_component_id)
                  if (matched) {
                    initialSearch = matched.name
                    saved.icon = matched.icon_url
                    actualRealPreview = matched.icon_url
                    saved.label = matched.name
                  } else {
                    // 通用组件已被删除，彻底回退
                    saved.common_component_id = null
                    saved.isOwned = false
                    actualRealPreview = ''
                    saved.icon = ''
                    saved.label = baseLabel
                  }
                }
                return {
                  ...saved,
                  compId,
                  type: baseType,
                  icon: saved.icon || baseIcon,
                  defaultIcon: baseIcon,
                  label: baseLabel,
                  defaultLabel: baseLabel,
                  realPreview: actualRealPreview,
                  searchQuery: initialSearch,
                  showDropdown: false,
                  common_component_id: saved.common_component_id || null,
                  realFile: null
                }
              } else {
                // 蓝图新增节点，报以默认状态
                return {
                  nodeId: node.id,
                  compId,
                  label: baseLabel,
                  defaultLabel: baseLabel,
                  type: baseType,
                  icon: baseIcon,
                  defaultIcon: baseIcon,
                  isActive: false,
                  isOwned: false,
                  realFile: null,
                  realPreview: '',
                  searchQuery: '',
                  showDropdown: false,
                  common_component_id: null
                }
              }
            })
          }
        } catch (e) {
          console.warn('模特蓝图解析失败，从套装快照回退:', e)
          if (cos.components_data) {
            const parsed = JSON.parse(cos.components_data)
            costumeComponents.value = parsed.map(c => {
              let q = ''
              let rp = c.realPreview || ''
              if (c.common_component_id) {
                const m = commonComponentsList.value.find(g => g.id === c.common_component_id)
                if (m) { q = m.name; c.icon = m.icon_url; rp = m.icon_url } else {
                  c.common_component_id = null; c.isOwned = false; rp = ''; c.icon = ''
                }
              }
              return { ...c, realPreview: rp, searchQuery: q, showDropdown: false, defaultLabel: c.defaultLabel || c.label, common_component_id: c.common_component_id || null, realFile: null }
            })
          }
        }
      } else if (cos.components_data) {
        // 无模特蓝图兜底：仅从快照中加载
        const parsedData = JSON.parse(cos.components_data)
        costumeComponents.value = parsedData.map(c => {
          let initialSearch = ''
          let actualRealPreview = c.realPreview || ''
          if (c.common_component_id) {
            const matched = commonComponentsList.value.find(g => g.id === c.common_component_id)
            if (matched) {
              initialSearch = matched.name
              c.icon = matched.icon_url
              actualRealPreview = matched.icon_url
              c.label = matched.name
            } else {
              c.common_component_id = null
              c.isOwned = false
              actualRealPreview = ''
              c.icon = ''
            }
          }
          return {
            ...c,
            realPreview: actualRealPreview,
            searchQuery: initialSearch,
            showDropdown: false,
            defaultLabel: c.defaultLabel || c.label,
            common_component_id: c.common_component_id || null,
            realFile: null
          }
        })
      }
    }
  } catch (error) {
    console.error('❌ 页面初始化崩溃，错误详情:', error)
    showToast('❌ 数据加载失败！')
  }
})

const selectOrigin = (name) => {
  // 核心清洗：防止用户点击含有“(新增作品)”字眼的条目时把后缀也存进去
  formData.value.origin = name.replace(/\s*\(新增作品\)$/, '').trim()
  showOriginDropdown.value = false
}

// 延迟关闭下拉框（防止与 mousedown 事件冲突）
const hideOriginDropdownWithDelay = () => {
  setTimeout(() => { showOriginDropdown.value = false }, 200)
}

// 🌟 根据节点所属的部位类型(type)与当前框内字符，计算联想匹配结果 🌟
const getFilteredCommonComponents = (comp) => {
  return commonComponentsList.value.filter(item => {
    const typeMatch = item.type === comp.type
    // 如果没有输入，默认激活时展示该部位下所有的通用组件；有输入则进行模糊匹配
    const queryMatch = !comp.searchQuery ? true : item.name.toLowerCase().includes(comp.searchQuery.toLowerCase())
    return typeMatch && queryMatch
  })
}

// 🌟 计算属性：对已有作品进行模糊搜索过滤
const filteredOrigins = computed(() => {
  if (!formData.value.origin) return originsList.value
  return originsList.value.filter(o =>
    o.name.toLowerCase().includes(formData.value.origin.toLowerCase())
  )
})

// 🌟 计算属性：判定当前输入的是否为尚未收录的新作品
const isNewOrigin = computed(() => {
  if (!formData.value.origin) return false
  // 将输入内容清理可能手贱打上去的"(新增作品)"后，再严格比对是否存在
  const cleanInput = formData.value.origin.replace(/\s*\(新增作品\)$/, '').trim().toLowerCase()
  return !originsList.value.some(o => o.name.toLowerCase() === cleanInput)
})


// 🌟 当用户在悬浮舱点击选定通用组件时 🌟
const selectCommonComponent = (index, item) => {
  const comp = costumeComponents.value[index]
  comp.common_component_id = item.id
  comp.searchQuery = item.name
  comp.label = item.name     // 🌟 名字同步：直接变成通用组件的正式名称
  comp.isOwned = true
  comp.realPreview = item.icon_url
  comp.icon = item.icon_url
  comp.showDropdown = false
}

// 🌟 当用户在输入框打字或删除字符时 🌟
const handleSearchInput = (index) => {
  const comp = costumeComponents.value[index]

  if (!comp.searchQuery) {
    // 删空了，彻底解绑，全部恢复最初蓝图状态
    comp.common_component_id = null
    comp.label = comp.defaultLabel // 🌟 名字恢复
    comp.realPreview = ''
    comp.realFile = null
    comp.icon = comp.defaultIcon || '❓'
  } else {
    const exactMatch = commonComponentsList.value.find(
      g => g.type === comp.type && g.name.trim() === comp.searchQuery.trim()
    )

    if (exactMatch) {
      comp.common_component_id = exactMatch.id
      comp.label = exactMatch.name // 🌟 精确匹配成功，改名
      comp.isOwned = true
      comp.realPreview = exactMatch.icon_url
      comp.icon = exactMatch.icon_url
    } else {
      // 删除了字符或打错字，失去匹配，退回原样
      comp.common_component_id = null
      comp.label = comp.defaultLabel // 🌟 名字恢复
      comp.realPreview = ''
      comp.realFile = null
      comp.icon = comp.defaultIcon || '❓'
    }
  }
}

// 延迟关闭联想弹窗，防止失去焦点事件与列表项的 mousedown 事件冲突
const hideDropdownWithDelay = (index) => {
  setTimeout(() => {
    if (costumeComponents.value[index]) {
      costumeComponents.value[index].showDropdown = false
    }
  }, 200)
}

// === 模型切换逻辑 ===
const handleModelChange = async (event) => {
  if (costumeComponents.value.length > 0 && costumeComponents.value.some(c => c.isActive)) {
    if (!confirm('更换模特将清空当前组件配置，确定吗？')) {
      event.preventDefault()
      return
    }
  }

  const modelId = formData.value.model_id
  try {
    // 实时拉取最新组件字典，确保名称/图标同步
    const [modelRes, compRes, commonRes] = await Promise.all([
      axios.get(`${API_BASE}/models/${modelId}`),
      axios.get(`${API_BASE}/components`),
      axios.get(`${API_BASE}/common-components`)
    ])
    const model = modelRes.data
    const componentTemplatesMap = new Map(compRes.data.map(c => [c.id, c]))
    const commonComponentsMap = new Map(commonRes.data.map(c => [c.id, c]))
    costumeComponents.value = []

    if (model.layout_data) {
      const graph = JSON.parse(model.layout_data)
      const compNodes = (graph.nodes || []).filter(n => n.type === 'component')

      costumeComponents.value = compNodes.map(node => {
        const compId = node.data.componentId
        const template = componentTemplatesMap.get(compId)
        // 用最新组件模板数据覆盖蓝图快照
        const label = template ? template.name : node.label
        const type = template ? template.type : node.data.type
        const icon = template ? template.icon_url : node.data.icon

        return {
          nodeId: node.id,
          compId,
          label,
          defaultLabel: label,
          type,
          icon,
          defaultIcon: icon,
          isActive: false,
          isOwned: false,
          realFile: null,
          realPreview: '',
          searchQuery: '',
          showDropdown: false,
          common_component_id: null
        }
      })
    }
  } catch (err) {
    showToast('❌ 解析蓝图失败！')
  }
}

// === 上传控制 ===
const uploadTarget = ref(null)
const fileInput = ref(null)
const cameraInput = ref(null)

const triggerUpload = (target, type) => {
  uploadTarget.value = target
  if (type === 'file') fileInput.value.click()
  if (type === 'camera') cameraInput.value.click()
}

const compressImage = (file, maxSizeMB = 1) => {
  return new Promise((resolve) => {
    if (file.size <= maxSizeMB * 1024 * 1024) return resolve(file)
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
          width *= ratio; height *= ratio
        }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          resolve(compressedFile)
        }, 'image/jpeg', 0.8)
      }
    }
  })
}

const handleFileSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  const compressed = await compressImage(file)

  if (uploadTarget.value === 'cover') {
    formData.value.coverFile = compressed
    formData.value.coverPreview = ''
  } else {
    const index = uploadTarget.value
    costumeComponents.value[index].realFile = compressed
    costumeComponents.value[index].realPreview = ''
  }
  event.target.value = ''
}

const readClipboard = async (target) => {
  uploadTarget.value = target
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      if (item.types.some(t => t.startsWith('image/'))) {
        const imageType = item.types.find(t => t.startsWith('image/'))
        const blob = await item.getType(imageType)
        const originalFile = new File([blob], 'clipboard_image.png', { type: blob.type })

        const compressed = await compressImage(originalFile)
        if (uploadTarget.value === 'cover') {
          formData.value.coverFile = compressed
          formData.value.coverPreview = ''
        } else {
          const index = uploadTarget.value
          costumeComponents.value[index].realFile = compressed
          costumeComponents.value[index].realPreview = ''
        }
        return showToast('✅ 成功捕获并压缩剪贴板图片！')
      }
      if (item.types.includes('text/plain')) {
        const blob = await item.getType('text/plain')
        const text = await blob.text()

        if (uploadTarget.value === 'cover') {
          formData.value.coverPreview = text.trim()
          formData.value.coverFile = null
        } else {
          const index = uploadTarget.value
          costumeComponents.value[index].realPreview = text.trim()
          costumeComponents.value[index].realFile = null
        }
        return showToast(`✅ 捕获剪贴板内容：${text.trim()}`)
      }
    }
    showToast('⚠️ 剪贴板里似乎没有我能认出的东西。')
  } catch (err) {
    showToast('❌ 无法读取，请检查浏览器是否允许访问剪贴板。')
  }
}

// === 保存保存提交引擎 ===
const saveCostume = async () => {
  if (!formData.value.name) return showToast('❌ 套装必须有名字！')
  if (!formData.value.model_id) return showToast('❌ 必须绑定模特！')

  // 1. 核心校验：百宝箱组件是否存在
  const activeComps = costumeComponents.value.filter(c => c.isActive)
  for (const comp of activeComps) {
    if (comp.searchQuery && comp.searchQuery.trim() !== '') {
      const matchedGlobal = commonComponentsList.value.find(
        g => g.type === comp.type && g.name.trim() === comp.searchQuery.trim()
      )

      if (!matchedGlobal) {
        showToast(`❌ 节点 [${comp.label}] 输入的通用组件 "${comp.searchQuery}" 在百宝箱中不存在！`)
        return // 熔断
      }

      // 安全合流：确保数据链路绑定
      comp.common_component_id = matchedGlobal.id
      comp.isOwned = true
      comp.realPreview = matchedGlobal.icon_url
      comp.icon = matchedGlobal.icon_url
    }
  }

  isSaving.value = true
  try {
    // 2. 核心逻辑：作品源(Origin)清洗与自动注册
    // 先清理掉 UI 可能带入的 "(新增作品)" 后缀
    let finalOrigin = formData.value.origin.replace(/\s*\(新增作品\)$/, '').trim()
    formData.value.origin = finalOrigin // 同步回界面显示

    if (finalOrigin) {
      // 如果系统中不存在这个作品源，自动触发 POST 注册
      const exists = originsList.value.some(o => o.name.toLowerCase() === finalOrigin.toLowerCase())
      if (!exists) {
        await axios.post(`${API_BASE}/origins`, { name: finalOrigin })
        // 刷新本地作品列表以保持同步
        const originRes = await axios.get(`${API_BASE}/origins`)
        originsList.value = originRes.data
      }
    }

    // 3. 处理封面图片
    let finalCoverUrl = formData.value.coverPreview || ''
    if (formData.value.coverFile) {
      finalCoverUrl = await uploadToServer(formData.value.coverFile, 'costumes')
    }

    // 4. 处理组件图片
    const uploadPromises = activeComps.map(async (comp) => {
      // 只有在未绑定通用组件且确实有新上传文件时，才执行图片上传
      if (!comp.common_component_id && comp.realFile) {
        comp.realPreview = await uploadToServer(comp.realFile, 'costumes')
        comp.realFile = null
      }
      return comp
    })
    await Promise.all(uploadPromises)

    // 5. 数据清洗与组装 Payload，同时清理失效的 realPreview 引用
    const activeCommonIds = new Set(commonComponentsList.value.map(g => g.id))
    const finalComponentsData = costumeComponents.value.map(c => {
      const { realFile, searchQuery, showDropdown, ...rest } = c
      // 如果 realPreview 指向一个已不存在的通用组件图片链接，清空它
      if (rest.realPreview && rest.realPreview.startsWith('/assets/') && !rest.common_component_id) {
        rest.realPreview = ''
      }
      if (rest.common_component_id && !activeCommonIds.has(rest.common_component_id)) {
        rest.common_component_id = null
        rest.realPreview = ''
        rest.isOwned = false
      }
      return rest
    })

    const payload = {
      user_id: userId,
      name: formData.value.name,
      origin: finalOrigin, // 使用清洗后的名称
      model_id: formData.value.model_id,
      cover_url: finalCoverUrl,
      components_data: JSON.stringify(finalComponentsData),
      insert_after_id: insertAfterId,
      insert_before_id: insertBeforeId
    }

    // 6. 执行保存
    if (costumeId) {
      await axios.put(`${API_BASE}/costumes/${costumeId}`, payload)
      showToast('✨ 套装重铸成功！')
    } else {
      await axios.post(`${API_BASE}/costumes`, payload)
      showToast('✨ 新套装已入库！')
    }

    goBack()
  } catch (error) {
    console.error('Save error:', error)
    const msg = error.response?.data?.error || error.message || '未知错误'
    showToast(`❌ 保存失败：${msg}`)
  } finally {
    isSaving.value = false
  }
}

const uploadToServer = async (file, targetDir) => {
  const data = new FormData()
  data.append('file', file)
  try {
    const res = await axios.post(`${API_BASE}/upload?target=${targetDir}`, data)
    return res.data.url
  } catch (err) {
    const msg = err.response?.data?.error || err.message || '上传失败'
    throw new Error(msg)
  }
}

const goBack = () => {
  if (window.history.state && window.history.state.back) {
    router.back()
  } else {
    router.push('/app/inventory')
  }
}
</script>

<style scoped>
.forge-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.forge-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  border: none;
  padding: 10px;
  background: transparent;
  width: 100%;
  max-width: 1200px;
}

.required {
  color: #f44336;
}
.object-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.form-layout {
  display: flex;
  gap: 25px;
  align-items: flex-start;
  width: 100%;
}

@media (max-width: 768px) {
  .form-layout {
    flex-direction: column;
  }
}

.basic-info {
  flex: 1;
  width: 100%;
  min-width: 300px;
  max-width: 400px;
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
.clip-btn {
  width: 100%;
  font-size: 12px;
}
.preview-box {
  margin-bottom: 10px;
  padding: 10px;
  background: #000;
  border: 1px solid #333;
  text-align: center;
}

.components-info {
  flex: 1;
  width: 100%;
}
.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 20px;
}
@media (max-width: 768px) {
  .component-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  .basic-info {
    max-width: 100%;
  }
}

.comp-card {
  background: #222;
  border: 2px solid #444;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: 0.2s;
  /* 🌟 核心修复：允许内部悬浮列表飘出卡片边界进行遮挡，而不是硬性撑开高度 */
  overflow: visible !important;
  position: relative;
}
.comp-card.is-active {
  border-color: #ffd700;
  background: #2a2a20;
}
.activation-toggle {
  margin-bottom: 0;
  padding-bottom: 5px;
  border-bottom: 1px solid #444;
}

.comp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  transition: 0.2s;
}
.comp-icon {
  width: 40px;
  height: 40px;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  flex-shrink: 0;
}
.emoji-large {
  font-size: 24px;
}
.comp-name-box {
  flex: 1;
  overflow: hidden;
}
.comp-name {
  font-size: 14px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.comp-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px dashed #555;
  /* 🌟 核心修复：确保中间的动作包裹层也允许溢出内容可见 */
  overflow: visible !important;
}
.owned-toggle {
  margin: 0;
  font-size: 12px;
}

/* 🌟 新增：智能百宝箱联想悬浮舱专用像素 CSS 🌟 */
.common-box-search-field {
  position: relative;
  /* 保证悬浮卡片相对于本输入框定位 */
}
.mini-search-input {
  border-radius: 0;
  border-width: 2px;
}
.common-comp-dropdown {
  /* 🌟 核心修复：加 !important 强行脱离文档流，使其变成凌空悬浮状态，绝不挤压下方布局 */
  position: absolute !important;
  top: 100%;
  left: 0;
  width: 100%;
  /* 🌟 核心修复：把图层层级拉到最高，确保它能完美遮挡住下方的上传按钮、文本或其他卡片 */
  z-index: 9999 !important;

  padding: 4px !important;
  max-height: 140px;
  overflow-y: auto;
  background-color: #212529 !important;
  border: 2px solid #fff !important;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.9);
  /* 加深阴影增强悬浮立体感 */
}
.dropdown-ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.dropdown-li {
  padding: 6px;
  font-size: 11px;
  cursor: pointer;
  color: #fff;
  border-bottom: 1px dashed #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dropdown-li:hover {
  background-color: #00ff66;
  /* 独特的百宝箱青翠绿绿 */
  color: #000;
}
.dropdown-li:last-child {
  border-bottom: none;
}

/* 百宝箱已选提示 */
.common-linked-tip {
  background: #111 !important;
  padding: 8px !important;
  margin-top: 5px;
  border: 2px solid #00ff66 !important;
}

.inline-mini-upload {
  padding: 8px;
  margin-top: 5px;
  border-color: #666;
}
.mini-preview {
  padding: 5px;
  margin-bottom: 5px;
}
.mini-btn {
  font-size: 10px;
  padding: 4px 8px;
  flex: 1;
}
.clip-btn.mini-btn {
  width: 100%;
}

.action-footer {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  padding: 15px;
  background: #212529;
  border: 4px solid #fff;
  width: 100%;
}
</style>