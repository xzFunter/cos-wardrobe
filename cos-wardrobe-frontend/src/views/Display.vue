<template>
  <div class="display-container hide-scrollbar">

    <div class="rpg-header nes-container is-dark with-title">
      <p class="title">套装展台</p>
      <div class="header-content">
        <div class="costume-meta">
          <img v-if="isUrl(costumeData.cover_url)" :src="getAssetUrl(costumeData.cover_url)"
            class="meta-cover meta-img" />
          <div v-else class="meta-cover meta-emoji">{{ costumeData.cover_url || '❓' }}</div>

          <div class="meta-text">
            <span class="nes-text is-warning" style="font-size: 12px;">{{ costumeData.origin || '未知出处' }}</span>
            <h3 style="margin: 5px 0 0 0;">{{ costumeData.name || '加载中...' }}</h3>
            <div class="progress-text">
              收集进度: {{ ownedCount }} / {{ activeComps.length }}
            </div>
          </div>
        </div>

        <div class="action-group">
          <button class="nes-btn is-primary" @click="goToForge">🔨 重铸/编辑</button>
          <button class="nes-btn" @click="goBack">返回大厅</button>
        </div>
      </div>
    </div>

    <div ref="canvasAreaRef" :class="['canvas-area nes-container is-dark', { 'is-ready': isReady }]">
      <VueFlow v-if="nodes.length > 0" v-model:nodes="nodes" v-model:edges="edges" :min-zoom="minZoomLevel"
        :pan-on-drag="true" :zoom-on-scroll="true" :zoom-on-pinch="true" :prevent-default-zoom-pan="true"
        :fit-view-on-init="false"
        :default-edge-options="{ type: 'default', animated: true, style: { stroke: '#ffd700', strokeWidth: 3 } }"
        :nodes-draggable="false" :nodes-connectable="false" :elevate-nodes-on-select="false">
        <Background pattern-color="#444" :gap="20" :size="2" />

        <template #node-model="nodeProps">
          <div class="pixel-model-node">
            <div class="model-placeholder">
              <Handle v-for="handle in (nodeProps.data.customHandles || [])" :key="handle.id" :id="handle.id"
                type="target" :position="handle.position" class="rpg-handle custom-handle"
                :style="{ top: handle.y + '%', left: handle.x + '%' }" style="pointer-events: none;" />
              <img v-if="isUrl(nodeProps.data.image_url)" :src="getAssetUrl(nodeProps.data.image_url)"
                class="pixel-render model-image" @load="centerAndFit" />
              <span v-else class="emoji-huge model-image">{{ nodeProps.data.image_url }}</span>
            </div>
          </div>
        </template>

        <template #node-component="nodeProps">
          <div :class="[
            'pixel-component-box',
            { 'is-unowned': !nodeProps.data.common_component_id && !nodeProps.data.isOwned },
            { 'is-linked-global': nodeProps.data.common_component_id }
          ]">

            <div v-if="nodeProps.data.common_component_id" class="global-badge" title="全局百宝箱共享资产">
              🔗 共享
            </div>

            <Handle id="source-top" type="source" :position="Position.Top" class="rpg-handle"
              style="opacity: 0; pointer-events:none;" />
            <Handle id="source-bottom" type="source" :position="Position.Bottom" class="rpg-handle"
              style="opacity: 0; pointer-events:none;" />
            <Handle id="source-left" type="source" :position="Position.Left" class="rpg-handle"
              style="opacity: 0; pointer-events:none;" />
            <Handle id="source-right" type="source" :position="Position.Right" class="rpg-handle"
              style="opacity: 0; pointer-events:none;" />

            <div class="comp-icon" tabindex="0">
              <template v-if="nodeProps.data.realPreview && isUrl(nodeProps.data.realPreview)">
                <img :src="getAssetUrl(nodeProps.data.realPreview)" class="pixel-render zoomable-img" />
              </template>
              <template v-else>
                <img v-if="isUrl(nodeProps.data.icon)" :src="getAssetUrl(nodeProps.data.icon)"
                  class="pixel-render standard-img" />
                <span v-else class="emoji-large">{{ nodeProps.data.icon }}</span>
              </template>
            </div>

            <div class="comp-info">
              <div class="status-tag nes-text is-warning">[{{ nodeProps.data.type }}]</div>
              <div class="comp-name">{{ nodeProps.label }}</div>

              <div v-if="!nodeProps.data.common_component_id" class="toggle-wrapper" style="margin-top: 6px;">
                <input type="checkbox" class="pixel-switch" v-model="nodeProps.data.isOwned"
                  @change="toggleComponentOwnership(nodeProps.data)" @click.stop />
                <span style="font-size: 10px; margin-left: 6px; color: #fff;">
                  {{ nodeProps.data.isOwned ? '拥有' : '待补' }}
                </span>
              </div>
              <div v-else class="toggle-wrapper" style="margin-top: 6px;">
                <span class="nes-text is-success" style="font-size: 10px;">✨ 永久持有</span>
              </div>

            </div>
          </div>
        </template>
      </VueFlow>
    </div>

    <div class="zhanwei"></div>

    <div class="cards-dock">
      <div class="cards-scroll-container hide-scrollbar" ref="carouselRef" @mousemove="handleMouseMove"
        @mouseleave="stopAutoScroll">
        <div class="cards-track">
          <div v-for="costume in costumesList" :key="costume.id"
            :class="['card-item', { 'is-active': costume.id === costumeId }]" @click="switchCostume(costume.id)">
            <div class="card-inner is-rounded is-dark">
              <img v-if="isUrl(costume.cover_url)" :src="getAssetUrl(costume.cover_url)"
                class="card-cover pixel-render" />
              <div v-else class="emoji-cover">{{ costume.cover_url || '❓' }}</div>
            </div>
            <div class="card-name-plate">{{ costume.name }}</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { showToast } from '../utils/toast'
import { API_BASE, ASSET_BASE } from '../utils/api'
import { VueFlow, Handle, Position, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'

const { getNodes, dimensions, setViewport, getViewport, onMoveEnd } = useVueFlow()

const route = useRoute()
const router = useRouter()

const costumeId = computed(() => Number(route.params.id))
const userId = localStorage.getItem('currentUserId') || 1

const costumeData = ref({})
const modelData = ref({})
const activeComps = ref([])
const nodes = ref([])
const edges = ref([])

const minZoomLevel = ref(0.1)
const isReady = ref(false)

const costumesList = ref([])
const carouselRef = ref(null)

// 🌟 进度条核心修正：如果启用了通用组件，默认直接算入“已拥有”的总数中 🌟
const ownedCount = computed(() => activeComps.value.filter(c => c.common_component_id || c.isOwned).length)

const isUrl = (str) => str && typeof str === 'string' && (str.startsWith('http') || /\.(jpg|jpeg|png|gif|webp)$/i.test(str) || str.startsWith('/assets'))
const getAssetUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  if (url.startsWith('/assets')) return `${ASSET_BASE}${url}`
  return `${ASSET_BASE}/assets/costumes/${url}`
}

onMounted(async () => {
  axios.put(`${API_BASE}/users/${userId}/last-visited`, {
    costumeId: Number(costumeId.value)
  }).catch(err => console.warn('记录足迹到数据库失败', err));

  await fetchAllCostumes()
  await loadDisplayData(costumeId.value)
  await nextTick()
  centerActiveCard(false)
})

watch(() => route.params.id, async (newId) => {
  if (!newId) return;

  isReady.value = false;
  await new Promise(resolve => setTimeout(resolve, 400));

  // 🚀 新增：将足迹写入数据库，异步执行不阻塞页面渲染

  axios.put(`${API_BASE}/users/${userId}/last-visited`, {
    costumeId: Number(newId)
  }).catch(err => console.warn('记录足迹到数据库失败', err));

  nodes.value = [];
  edges.value = [];
  await loadDisplayData(Number(newId));
  await nextTick();
  centerActiveCard(true);
});

const fetchAllCostumes = async () => {
  try {
    const res = await axios.get(`${API_BASE}/costumes?userId=${userId}`)
    costumesList.value = res.data
  } catch (err) {
    console.error('获取展示列表失败！', err)
  }
}

const loadDisplayData = async (targetId) => {
  try {
    const cosRes = await axios.get(`${API_BASE}/costumes/${targetId}`)
    costumeData.value = cosRes.data
    const componentsData = JSON.parse(costumeData.value.components_data || '[]')

    activeComps.value = componentsData.filter(c => c.isActive)
    const activeNodeIds = new Set(activeComps.value.map(c => c.nodeId))

    const modelRes = await axios.get(`${API_BASE}/models/${costumeData.value.model_id}`)
    modelData.value = modelRes.data
    const rawGraph = JSON.parse(modelData.value.layout_data || '{}')

    const filteredNodes = (rawGraph.nodes || []).filter(n => {
      if (n.type === 'model') return true
      return activeNodeIds.has(n.id)
    }).map(n => {
      n.draggable = false
      if (n.type === 'component') {
        const cData = activeComps.value.find(c => c.nodeId === n.id)
        n.data = { ...n.data, ...cData }

        // 🌟 核心名称注入：如果工坊里更改了通用组件名称，将新名称热绑定赋值给 Canvas 节点 label 🌟
        if (cData && cData.label) {
          n.label = cData.label
        }
      }
      return n
    })

    const filteredEdges = (rawGraph.edges || []).filter(e => {
      const sourceExists = filteredNodes.some(n => n.id === e.source)
      const targetExists = filteredNodes.some(n => n.id === e.target)
      return sourceExists && targetExists
    })

    const usedHandleIds = new Set(filteredEdges.map(e => e.targetHandle))
    filteredNodes.forEach(n => {
      if (n.type === 'model' && n.data && n.data.customHandles) {
        n.data.customHandles = n.data.customHandles.filter(handle => usedHandleIds.has(handle.id))
      }
    })

    nodes.value = filteredNodes
    edges.value = filteredEdges

    await nextTick()
    await centerAndFit()
  } catch (err) {
    showToast('❌ 数据加载失败！')
  }
}

const canvasAreaRef = ref(null)

const centerAndFit = async () => {
  await new Promise(resolve => {
    let attempts = 0
    const check = () => {
      const modelNode = getNodes.value.find(n => n.type === 'model')
      if (modelNode?.dimensions?.width > 0 || attempts > 20) { resolve() }
      else { attempts++; setTimeout(check, 50) }
    }
    check()
  })

  const nodesList = getNodes.value
  const modelNode = nodesList.find(n => n.type === 'model')
  if (!modelNode?.dimensions?.width) { isReady.value = true; return }

  const mx = modelNode.position.x + modelNode.dimensions.width / 2
  const my = modelNode.position.y + modelNode.dimensions.height / 2

  let minX = mx, maxX = mx, minY = my, maxY = my
  nodesList.forEach(n => {
    const nx1 = n.position.x
    const ny1 = n.position.y
    const nx2 = nx1 + (n.dimensions.width || 0)
    const ny2 = ny1 + (n.dimensions.height || 0)
    if (nx1 < minX) minX = nx1
    if (nx2 > maxX) maxX = nx2
    if (ny1 < minY) minY = ny1
    if (ny2 > maxY) maxY = ny2
  })

  const padding = window.innerWidth <= 768 ? 1.02 : 1.05
  const dx = Math.max(Math.abs(mx - minX), Math.abs(maxX - mx)) * padding
  const dy = Math.max(Math.abs(my - minY), Math.abs(maxY - my)) * padding
  if (dx === 0 || dy === 0) return

  const cw = canvasAreaRef.value ? canvasAreaRef.value.clientWidth : window.innerWidth
  const ch = canvasAreaRef.value ? canvasAreaRef.value.clientHeight : window.innerHeight
  if (cw === 0 || ch === 0) return

  let zoom = Math.min(cw / (dx * 2), ch / (dy * 2))
  if (zoom > 2) zoom = 2
  if (zoom < 0.1) zoom = 0.1
  minZoomLevel.value = zoom

  const viewportX = (cw / 2) - (mx * zoom)
  const viewportY = (ch / 2) - (my * zoom)

  setViewport({ x: viewportX, y: viewportY, zoom })
  await nextTick()
  isReady.value = true
}

let snapTimer = null
onMoveEnd(() => {
  if (snapTimer) clearTimeout(snapTimer)
  snapTimer = setTimeout(() => {
    const viewport = getViewport()
    if (viewport.zoom <= minZoomLevel.value + 0.05) { centerAndFit() }
  }, 100)
})

const toggleComponentOwnership = async (nodeData) => {
  try {
    const compInArray = activeComps.value.find(c => c.nodeId === nodeData.nodeId)
    if (compInArray) compInArray.isOwned = nodeData.isOwned

    const fullComponentsData = JSON.parse(costumeData.value.components_data)
    const updatedFullData = fullComponentsData.map(c => {
      if (c.nodeId === nodeData.nodeId) return { ...c, isOwned: nodeData.isOwned }
      return c
    })

    await axios.put(`${API_BASE}/costumes/${costumeId.value}`, {
      name: costumeData.value.name,
      origin: costumeData.value.origin,
      model_id: costumeData.value.model_id,
      cover_url: costumeData.value.cover_url,
      components_data: JSON.stringify(updatedFullData)
    })
  } catch (error) {
    nodeData.isOwned = !nodeData.isOwned
    showToast('❌ 状态同步失败，网络波动。')
  }
}

const switchCostume = (id) => {
  if (id === costumeId.value) return
  router.push(`/app/display/${id}`)
}

const centerActiveCard = (smooth = true) => {
  if (!carouselRef.value) return
  const container = carouselRef.value
  setTimeout(() => {
    const activeEl = container.querySelector('.card-item.is-active')
    if (!activeEl) return
    const containerWidth = container.clientWidth
    const cardWidth = activeEl.offsetWidth
    const realCardWidth = activeEl.classList.contains('is-active') ? cardWidth / 1.4 : cardWidth
    const targetScroll = activeEl.offsetLeft + (realCardWidth / 2) - (containerWidth / 2)
    const maxScroll = container.scrollWidth - container.clientWidth
    const finalScroll = Math.max(0, Math.min(targetScroll, maxScroll))

    container.scrollTo({ left: finalScroll, behavior: smooth ? 'smooth' : 'auto' })
  }, 50)
}

let scrollAnimationFrame = null
let scrollSpeed = 0

const handleMouseMove = (e) => {
  if (window.innerWidth <= 768) return
  if (!carouselRef.value) return
  const { left, right } = carouselRef.value.getBoundingClientRect()
  const mouseX = e.clientX
  const edgeThreshold = 150
  const maxSpeed = 12

  if (mouseX < left + edgeThreshold) {
    const intensity = 1 - (mouseX - left) / edgeThreshold
    scrollSpeed = -intensity * maxSpeed
  } else if (mouseX > right - edgeThreshold) {
    const intensity = 1 - (right - mouseX) / edgeThreshold
    scrollSpeed = intensity * maxSpeed
  } else { scrollSpeed = 0 }

  if (scrollSpeed !== 0 && !scrollAnimationFrame) { scrollLoop() }
}

const scrollLoop = () => {
  if (scrollSpeed === 0) {
    cancelAnimationFrame(scrollAnimationFrame)
    scrollAnimationFrame = null
    return
  }
  if (carouselRef.value) { carouselRef.value.scrollLeft += scrollSpeed }
  scrollAnimationFrame = requestAnimationFrame(scrollLoop)
}

const stopAutoScroll = () => {
  scrollSpeed = 0
  if (scrollAnimationFrame) {
    cancelAnimationFrame(scrollAnimationFrame)
    scrollAnimationFrame = null
  }
}

onUnmounted(() => { stopAutoScroll() })
const goToForge = () => router.push(`/app/forge/${costumeId.value}`)
const goBack = () => router.push('/app/inventory')
</script>

<style scoped>
.display-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}
.rpg-header {
  margin: 15px;
  padding: 15px;
  z-index: 10;
  display: flex;
  flex-direction: column;
}
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}
.costume-meta {
  display: flex;
  align-items: center;
  gap: 15px;
}
.meta-cover {
  width: 80px;
  height: 100px;
  border: 2px solid #fff;
  background: #000;
  padding: 2px;
  box-sizing: border-box;
}
.meta-img {
  object-fit: contain;
}
.meta-emoji {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 30px;
}
.progress-text {
  margin-top: 5px;
  font-size: 12px;
  color: #4cd964;
}
.action-group {
  display: flex;
  gap: 10px;
}

.canvas-area {
  flex: 1;
  margin: 0 15px 180px 15px;
  padding: 0 !important;
  border: 4px solid #fff;
  position: relative;
  overflow: hidden;
  contain: layout size;
  opacity: 0;
  transition: opacity 0.4s ease-out;
  touch-action: none !important;
  z-index: 1;
}
.canvas-area.is-ready {
  opacity: 1;
}

.zhanwei {
  height: 115px;
}

/* 底部手牌卡槽 */
.cards-dock {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
  display: flex;
  align-items: flex-end;
  z-index: 100;
  pointer-events: none;
}
.cards-scroll-container {
  width: 100%;
  height: 215px;
  overflow-x: auto;
  padding: 20px;
  box-sizing: border-box;
  will-change: scroll-position;
  pointer-events: none;
}
.cards-track {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  height: 160px;
  pointer-events: none;
  /* 关键：找回卡片区域的控制权 */
}
.card-item {
  position: relative;
  width: 80px;
  height: 110px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transform-origin: bottom center;
  z-index: 1;
  pointer-events: auto;
  /* 关键：找回卡片区域的控制权 */
}
.card-item:not(.is-active):hover {
  transform: translateY(-15px) scale(1.15);
  z-index: 10;
}
.card-item.is-active {
  transform: translateY(-20px) scale(1.4);
  z-index: 20;
}
.card-item.is-active .card-inner {
  border-color: #ffd700;
  box-shadow: 0 0 15px #ffd700;
}
.card-item.is-active .card-name-plate {
  background: #ffd700;
  color: #000;
}
.card-inner {
  width: 100%;
  height: 100%;
  background: #2a2a2a;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 2px solid #555;
}
.card-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.emoji-cover {
  font-size: 40px;
}
.card-name-plate {
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #000;
  border: 1px solid #fff;
  color: #fff;
  padding: 2px 4px;
  font-size: 9px;
  white-space: nowrap;
}

/* 隐藏滚动条 */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* ======= 画布节点像素级样式 ======= */
:deep(.rpg-handle) {
  width: 12px;
  height: 12px;
  background-color: #ffd700;
  border: 2px solid #fff;
  border-radius: 0;
  box-shadow: 0 0 5px #ffd700;
}
:deep(.custom-handle) {
  position: absolute !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  z-index: 20;
}
.pixel-model-node {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.model-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
.model-image {
  max-height: 450px;
  max-width: 600px;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.5));
}

.pixel-component-box {
  display: flex;
  align-items: center;
  background: #222;
  border: 3px solid #ffd700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.25);
  padding: 8px;
  min-width: 150px;
  position: relative;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 🌟 新增：全局共享通用组件专属外观类（高贵翡翠绿流光） 🌟 */
.pixel-component-box.is-linked-global {
  border-color: #00ff66 !important;
  box-shadow: 0 0 15px rgba(0, 255, 102, 0.45);
  background: linear-gradient(135deg, #181818 0%, #152b1b 100%) !important;
}
/* 🌟 新增：右上角绝对定位的共享缎带徽章 🌟 */
.global-badge {
  position: absolute;
  top: -6px;
  left: -6px;
  background: #00ff66;
  color: #000;
  font-size: 8px;
  padding: 1px 4px;
  border: 1px solid #fff;
  font-weight: bold;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.pixel-component-box.is-unowned {
  opacity: 0.8;
  background: #545353;
  border-color: #8b8b8b;
  filter: grayscale(80%) brightness(0.4) contrast(1.2);
  box-shadow: none;
}
.pixel-component-box.is-unowned .comp-name, .pixel-component-box.is-unowned .status-tag {
  color: #d6d5d5 !important;
}
.comp-info {
  display: flex;
  flex-direction: column;
}
.comp-name {
  font-weight: bold;
  font-size: 14px;
  margin-top: 4px;
}
.status-tag {
  font-size: 10px;
}
.comp-icon {
  width: 40px;
  height: 40px;
  border: 1px solid #555;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 12px;
  position: relative;
  cursor: pointer;
  outline: none;
  background: #111;
  transition: all 0.3s;
}
.pixel-component-box:not(.is-unowned) .comp-icon {
  background: #2a2a20;
  border-color: #ffd700;
}
.pixel-component-box.is-linked-global .comp-icon {
  border-color: #00ff66;
  background: #122217;
}

.emoji-large {
  font-size: 24px;
}
.standard-img {
  max-width: 32px;
  max-height: 32px;
}
.zoomable-img {
  width: 38px;
  height: 38px;
  object-fit: cover;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  z-index: 1;
}
.comp-icon:hover .zoomable-img, .comp-icon:focus .zoomable-img {
  transform: scale(4.5);
  z-index: 1000;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.8);
  border: 1px solid #fff;
  border-radius: 4px;
}

.toggle-wrapper {
  display: flex;
  align-items: center;
}
.pixel-switch {
  appearance: none;
  width: 32px;
  height: 16px;
  background: #444;
  border: 2px solid #aaa;
  position: relative;
  cursor: pointer;
  outline: none;
  transition: background 0.2s, border-color 0.2s;
}
.pixel-switch:checked {
  background: #4cd964;
  border-color: #fff;
}
.pixel-switch::after {
  content: '';
  position: absolute;
  top: 0px;
  left: 0px;
  width: 12px;
  height: 12px;
  background: #aaa;
  transition: left 0.2s, background 0.2s;
}
.pixel-switch:checked::after {
  left: 16px;
  background: #fff;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
  }
  .action-group {
    justify-content: space-between;
  }
  .action-group .nes-btn {
    flex: 1;
    padding: 6px;
    font-size: 12px;
  }
  .canvas-area {
    margin-bottom: 140px;
  }
  .cards-track {
    gap: 2px;
  }
  .card-item {
    width: 60px;
    height: 82px;
  }
  .card-item.is-active {
    transform: translateY(-15px) scale(1.3);
  }
}
</style>