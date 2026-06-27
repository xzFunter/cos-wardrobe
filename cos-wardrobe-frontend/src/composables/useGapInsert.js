import { ref, nextTick, onUnmounted } from 'vue'
import axios from 'axios'
import { showToast } from '../utils/toast'
import { API_BASE } from '../utils/api'

/**
 * 网格卡片缝隙插入 + 排序微交互 composable
 * 适用于 Inventory / Chest / Office 等网格列表页
 *
 * @param {object} options
 * @param {() => Array} options.getCurrentList  获取当前数据列表的函数
 * @param {string}   options.tableName          后端 sort_order 表名 (如 'user_costumes')
 * @param {() => Promise} options.fetchData      重新拉取数据的函数
 * @param {string}   [options.gridSelector='.costume-grid']  网格容器 CSS 选择器
 * @param {string}   [options.wrapperSelector='.costume-card-wrapper']  卡片包装器 CSS 选择器
 */
export function useGapInsert(options) {
  const {
    getCurrentList,
    tableName,
    fetchData,
    gridSelector = '.costume-grid',
    wrapperSelector = '.costume-card-wrapper'
  } = options

  const isSorting = ref(false)
  const expandedGap = ref(null)
  const shiftedCards = ref({})
  const cardStatuses = ref([])

  let resizeObserver = null

  const updateRowStatuses = () => {
    const wrappers = document.querySelectorAll(wrapperSelector)
    const statuses = new Array(wrappers.length).fill(null).map(() => ({ isFirst: false, isLast: false }))
    if (wrappers.length === 0) { cardStatuses.value = statuses; return }

    let currentRowY = -1
    wrappers.forEach((el, index) => {
      const y = el.offsetTop
      if (y !== currentRowY) {
        if (index > 0) statuses[index - 1].isLast = true
        currentRowY = y
        statuses[index].isFirst = true
      }
    })
    if (wrappers.length > 0) statuses[wrappers.length - 1].isLast = true
    cardStatuses.value = statuses
  }

  const expandGap = (id, side) => {
    const list = getCurrentList()
    expandedGap.value = `${id}-${side}`
    const newShifted = {}

    const targetIndex = list.findIndex(c => c.id === id)
    if (targetIndex === -1) return

    const shiftVal = window.innerWidth <= 768 ? '50px' : '55px'
    const shiftValNeg = window.innerWidth <= 768 ? '-50px' : '-55px'

    requestAnimationFrame(() => {
      const wrappers = document.querySelectorAll(wrapperSelector)
      const targetWrapper = wrappers[targetIndex]
      if (!targetWrapper) return

      const rowY = targetWrapper.offsetTop
      const status = cardStatuses.value[targetIndex]

      if (side === 'left') {
        for (let i = targetIndex; i < wrappers.length; i++) {
          if (wrappers[i].offsetTop === rowY) newShifted[list[i].id] = shiftVal
          else break
        }
      } else if (side === 'right') {
        if (status.isLast) {
          for (let i = targetIndex; i >= 0; i--) {
            if (wrappers[i].offsetTop === rowY) newShifted[list[i].id] = shiftValNeg
            else break
          }
        } else {
          for (let i = targetIndex + 1; i < wrappers.length; i++) {
            if (wrappers[i].offsetTop === rowY) newShifted[list[i].id] = shiftVal
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

  const handleGapClick = (id, side, onConfirm) => {
    const gapKey = `${id}-${side}`
    if (expandedGap.value === gapKey) {
      if (onConfirm) onConfirm({ id, side })
      collapseGap()
    } else {
      expandGap(id, side)
    }
  }

  const moveItem = (index, direction) => {
    const list = getCurrentList()
    const targetIndex = direction === 'prev' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= list.length) return
    ;[list[index], list[targetIndex]] = [list[targetIndex], list[index]]
  }

  const toggleSortingMode = async () => {
    if (!isSorting.value) {
      isSorting.value = true
      showToast('🧙‍♂️ 开启整队模式')
    } else {
      try {
        const idList = getCurrentList().map(item => item.id)
        await axios.post(`${API_BASE}/save-order`, { table: tableName, idList })
        isSorting.value = false
        showToast('✨ 序列已安全存档！')
        await fetchData()
      } catch (err) {
        showToast('❌ 保存失败')
      }
    }
  }

  const initResizeObserver = () => {
    const grid = document.querySelector(gridSelector)
    if (grid) {
      resizeObserver = new ResizeObserver(() => updateRowStatuses())
      resizeObserver.observe(grid)
    }
  }

  const destroy = () => {
    document.removeEventListener('click', collapseGap)
    if (resizeObserver) resizeObserver.disconnect()
  }

  return {
    isSorting,
    expandedGap,
    shiftedCards,
    cardStatuses,
    updateRowStatuses,
    expandGap,
    collapseGap,
    handleGapMouseEnter,
    handleGapMouseLeave,
    handleGapClick,
    moveItem,
    toggleSortingMode,
    initResizeObserver,
    destroy
  }
}
