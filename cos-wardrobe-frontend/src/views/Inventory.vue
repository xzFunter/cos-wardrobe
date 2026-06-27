<template>
  <div class="inventory-container">
    <div class="nes-container is-dark with-title header">
      <p class="title">装备大厅</p>
      <div class="header-info" style="display: flex; justify-content: space-between; align-items: center;">
        <span>勇者仓库</span>
        <button v-if="costumes.length > 0" :class="['nes-btn', isSorting ? 'is-warning' : 'is-primary']"
          @click="toggleSortingMode" style="font-size: 12px; padding: 4px 8px;">
          {{ isSorting ? '💾 完成保存' : '⚔️ 调整顺序' }}
        </button>
      </div>
    </div>

    <div :class="['costume-grid hide-scrollbar', { 'sorting-fever': isSorting }]">

      <div v-if="costumes.length === 0" class="nes-container is-rounded is-dark costume-card add-card"
        @click="goToForge">
        <div class="cover-placeholder">➕</div>
        <p class="costume-name nes-text is-disabled" style="background: transparent; bottom: 20px;">这里空空如也，锻造第一套装备吧！</p>
      </div>

      <div v-for="(costume, index) in costumes" :key="costume.id" class="costume-card-wrapper"
        :style="{ transform: shiftedCards[costume.id] ? `translateX(${shiftedCards[costume.id]})` : 'none' }"
        :class="{ 'is-shifted': !!shiftedCards[costume.id] }">

        <div class="nes-container is-rounded is-dark costume-card" @click="handleCardClick(costume.id)">
          <img v-if="isUrl(costume.cover_url)" :src="getAssetUrl(costume.cover_url)"
            class="costume-image pixel-render" />
          <div v-else class="emoji-icon">{{ costume.cover_url || '❓' }}</div>
          <p class="costume-name">{{ costume.name }}</p>

          <div class="sort-controller" v-if="isSorting" @click.stop>
            <button class="nes-btn is-error sort-btn" :disabled="index === 0"
              @click="moveItem(index, 'prev')">◀</button>
            <span style="font-size: 10px; color:#ffd700;">{{ index + 1 }}</span>
            <button class="nes-btn is-success sort-btn" :disabled="index === costumes.length - 1"
              @click="moveItem(index, 'next')">▶</button>
          </div>
        </div>

        <div v-if="cardStatuses[index]?.isFirst"
          :class="['gap-insert-anchor', 'is-left', { 'is-expanded': expandedGap === `${costume.id}-left` }]"
          @mouseenter="handleGapMouseEnter(costume.id, 'left')" @mouseleave="handleGapMouseLeave"
          @click.stop="handleGapClick(costume.id, 'left')">
          <div class="gap-plus-btn">＋</div>
        </div>

        <div :class="['gap-insert-anchor', 'is-right', { 'is-expanded': expandedGap === `${costume.id}-right` }]"
          @mouseenter="handleGapMouseEnter(costume.id, 'right')" @mouseleave="handleGapMouseLeave"
          @click.stop="handleGapClick(costume.id, 'right')">
          <div class="gap-plus-btn">＋</div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { showToast } from '../utils/toast'
import { API_BASE, ASSET_BASE } from '../utils/api'

const costumes = ref([])
const isSorting = ref(false)
const router = useRouter()
const userId = localStorage.getItem('currentUserId')

// 🌟 交互魔法状态变量 🌟
const expandedGap = ref(null)      // 例如: '12-left' 或 '12-right'
const shiftedCards = ref({})       // 记录需要位移的卡片及距离，例如: { '12': '55px', '13': '-55px' }
const cardStatuses = ref([])       // 记录每张卡片是否是行首/行尾

const isUrl = (str) => str && typeof str === 'string' && (str.startsWith('http') || /\.(jpg|jpeg|png|gif|webp)$/i.test(str))
const getAssetUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  if (url.startsWith('/assets')) return `${ASSET_BASE}${url}`
  return `${ASSET_BASE}/assets/costumes/${url}`
}

const loadData = async () => {
  try {
    const res = await axios.get(`${API_BASE}/costumes?userId=${userId}`)
    costumes.value = res.data
  } catch (error) {
    console.error(error)
  }
}

// 🌟 核心侦测：利用 DOM 物理坐标，动态计算每张卡片是不是行头或行尾
const updateRowStatuses = () => {
  const wrappers = document.querySelectorAll('.costume-card-wrapper')
  const statuses = new Array(wrappers.length).fill(null).map(() => ({ isFirst: false, isLast: false }))
  if (wrappers.length === 0) { cardStatuses.value = statuses; return }

  let currentRowY = -1
  let currentRowStartIndex = 0

  wrappers.forEach((el, index) => {
    const y = el.offsetTop
    if (y !== currentRowY) {
      if (index > 0) statuses[index - 1].isLast = true
      currentRowY = y
      currentRowStartIndex = index
      statuses[index].isFirst = true
    }
  })
  if (wrappers.length > 0) statuses[wrappers.length - 1].isLast = true
  cardStatuses.value = statuses
}

let resizeObserver
onMounted(() => {
  if (!userId) return router.push('/')
  loadData()

  document.addEventListener('click', collapseGap)

  const grid = document.querySelector('.costume-grid')
  if (grid) {
    resizeObserver = new ResizeObserver(() => updateRowStatuses())
    resizeObserver.observe(grid)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', collapseGap)
  if (resizeObserver) resizeObserver.disconnect()
})

watch(costumes, async () => {
  await nextTick()
  updateRowStatuses()
})

const handleCardClick = (id) => {
  if (isSorting.value) return
  router.push(`/app/display/${id}`)
}

// ====== 🌟 史诗级让位魔法：原力推开算法 ======
const expandGap = (id, side) => {
  expandedGap.value = `${id}-${side}`
  const newShifted = {}

  const targetIndex = costumes.value.findIndex(c => c.id === id)
  if (targetIndex === -1) return

  // 计算屏幕响应式的排挤距离
  const shiftVal = window.innerWidth <= 768 ? '50px' : '55px'
  const shiftValNeg = window.innerWidth <= 768 ? '-50px' : '-55px'

  requestAnimationFrame(() => {
    const wrappers = document.querySelectorAll('.costume-card-wrapper')
    const targetWrapper = wrappers[targetIndex]
    if (!targetWrapper) return

    const rowY = targetWrapper.offsetTop
    const status = cardStatuses.value[targetIndex]

    if (side === 'left') {
      // 场景 1: 点击行首左侧，当前及后续同行卡片全部往【右】让路
      for (let i = targetIndex; i < wrappers.length; i++) {
        if (wrappers[i].offsetTop === rowY) newShifted[costumes.value[i].id] = shiftVal
        else break
      }
    } else if (side === 'right') {
      if (status.isLast) {
        // 场景 2: 点击行末右侧，当前及之前同行卡片全部往【左】让路
        for (let i = targetIndex; i >= 0; i--) {
          if (wrappers[i].offsetTop === rowY) newShifted[costumes.value[i].id] = shiftValNeg
          else break
        }
      } else {
        // 场景 3: 点击中间缝隙，后续同行卡片全部往【右】让路
        for (let i = targetIndex + 1; i < wrappers.length; i++) {
          if (wrappers[i].offsetTop === rowY) newShifted[costumes.value[i].id] = shiftVal
          else break
        }
      }
    }
    shiftedCards.value = newShifted
  })
}

const collapseGap = () => {
  expandedGap.value = null
  shiftedCards.value = {}
}

const handleGapMouseEnter = (id, side) => {
  if (window.matchMedia('(hover: hover)').matches) expandGap(id, side)
}
const handleGapMouseLeave = () => {
  if (window.matchMedia('(hover: hover)').matches) collapseGap()
}

// 完美兼容手机的“一击激活，再击确认”手势逻辑
const handleGapClick = (id, side) => {
  const gapKey = `${id}-${side}`
  if (expandedGap.value === gapKey) {
    // 根据触发的方向，向后端下达精准的“前插”或“后插”指令
    router.push({ path: '/app/forge', query: side === 'left' ? { insertBefore: id } : { insertAfter: id } })
    collapseGap()
  } else {
    expandGap(id, side)
  }
}

const toggleSortingMode = async () => {
  if (!isSorting.value) {
    isSorting.value = true
    showToast('🧙‍♂️ 开启整队模式，缝隙亦可插槽')
  } else {
    try {
      const idList = costumes.value.map(c => c.id)
      await axios.post(`${API_BASE}/save-order`, { table: 'user_costumes', idList })
      isSorting.value = false
      showToast('✨ 队伍序列已安全存档！')
      await loadData()
    } catch (err) {
      showToast('❌ 存档失败')
    }
  }
}

const moveItem = (index, direction) => {
  const targetIndex = direction === 'prev' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= costumes.value.length) return
  [costumes.value[index], costumes.value[targetIndex]] = [costumes.value[targetIndex], costumes.value[index]]
}

const goToForge = () => router.push('/app/forge')
</script>

<style scoped>
.inventory-container {
  height: 100vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow-x: hidden;
}
.header {
  margin-bottom: 30px;
}

/* 网格间距固定 15px */
.costume-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  padding: 20px 0;
  overflow-x: visible;
}

/* 🌟 卡片包装器，支持平滑位移 */
.costume-card-wrapper {
  position: relative;
  width: 100%;
  transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 1;
}

/* 处于运动中的卡片短暂提升层级，防止遮挡动画 */
.costume-card-wrapper.is-shifted {
  z-index: 10;
}

.costume-card {
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
.costume-card:hover {
  border-color: #ffd700;
}

/* 🌟🌟 缝隙插桩纽扣的绝对物理空间锚定 🌟🌟 */
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

/* 按钮基础样式 */
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

/* 🌟 巨型扩张形态：极具视觉冲击力的横向吞噬与按钮膨胀 🌟 */
.gap-insert-anchor.is-expanded {
  opacity: 1 !important;
  width: 70px;
  /* 精确覆盖 15px 原始缝隙 + 55px 推挤空间 */
}
/* 向左推挤或向右推挤，都能利用巧妙的负数定位做到完美的缝隙填补 */
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

/* 桌面端平时探路微亮 */
@media (min-width: 769px) {
  .costume-card-wrapper:hover .gap-insert-anchor:not(.is-expanded) {
    opacity: 0.6;
  }
}

/* 移动端排序时微亮，作为点击诱导 */
.sorting-fever .gap-insert-anchor:not(.is-expanded) {
  opacity: 0.6;
}

/* 排序晃动动画 */
.sorting-fever .costume-card:not(.add-card) {
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
  z-index: 10;
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

.costume-image {
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
.add-card {
  border-style: dashed;
  cursor: pointer;
}
.cover-placeholder {
  font-size: 80px;
  margin-bottom: 15px;
  z-index: 2;
}
.costume-name {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  margin: 0;
  padding: 6px 4px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 12px;
  text-align: center;
  z-index: 5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .costume-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    padding: 10px;
    width: 100%;
  }
  .costume-card {
    height: 180px;
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

  .gap-insert-anchor.is-expanded {
    width: 60px;
  }
  .gap-insert-anchor.is-right.is-expanded {
    right: -60px;
  }
  .gap-insert-anchor.is-left.is-expanded {
    left: -60px;
  }
}
</style>