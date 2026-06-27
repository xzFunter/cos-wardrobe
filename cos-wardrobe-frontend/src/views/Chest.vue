<template>
    <div class="chest-container">
        <div class="nes-container is-dark with-title chest-main">
            <p class="title">百宝箱 (通用组件库)</p>

            <div class="header-tools"
                style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">

                <div class="info-group">
                    <span class="nes-text is-success" style="font-size: 14px;">📦 全局共享资产管理</span>
                </div>

                <div class="sort-group" v-if="currentList.length > 0">
                    <button :class="['nes-btn', isSorting ? 'is-warning' : 'is-primary']" @click="toggleSortingMode"
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

                        <img v-if="isUrl(item.icon_url)" :src="getAssetUrl(item.icon_url)"
                            class="item-image pixel-render" />
                        <div v-else class="emoji-icon">{{ item.icon_url || '❓' }}</div>

                        <p class="item-name">{{ item.name }}</p>

                        <div class="sort-controller" v-if="isSorting" @click.stop>
                            <button class="nes-btn is-error sort-btn" :disabled="index === 0"
                                @click="moveItem(index, 'prev')">◀</button>
                            <span style="font-size: 10px; color:#ffd700;">{{ index + 1 }}</span>
                            <button class="nes-btn is-success sort-btn" :disabled="index === currentList.length - 1"
                                @click="moveItem(index, 'next')">▶</button>
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

                <div v-if="currentList.length === 0" style="grid-column: 1 / -1; text-align: center; padding: 40px 0;">
                    <p class="nes-text is-disabled">百宝箱内空空如也...</p>
                    <button class="nes-btn is-success" @click="() => openAddModal(null)">＋ 锻造第一个通用组件</button>
                </div>
            </div>
        </div>

        <div class="modal-overlay" v-if="showModal">
            <div class="nes-dialog is-dark modal-box">
                <p class="title" style="margin-bottom: 20px; font-size: 20px;">
                    {{ isEditMode ? '重铸 / 销毁' : '锻造新' }}通用组件
                </p>

                <div class="nes-field form-group">
                    <label>组件名称</label>
                    <input type="text" class="nes-input is-dark" v-model="formData.name" placeholder="输入组件名称...">
                </div>

                <div class="nes-field form-group">
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
                    <button v-if="isEditMode" class="nes-btn is-error delete-btn" @click="deleteItem">销毁组件</button>
                    <div style="margin-left:auto; display:flex; gap: 15px;">
                        <button class="nes-btn" @click="showModal = false">取消</button>
                        <button class="nes-btn is-primary" @click="submitForm">{{ isEditMode ? '保存重铸' : '确认锻造'
                        }}</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import axios from 'axios'
import { showToast } from '../utils/toast'
import { API_BASE, ASSET_BASE } from '../utils/api'
import { isUrl, getAssetUrl } from '../utils/asset'
import { compressImage } from '../utils/image'
import UploadSection from '../components/UploadSection.vue'
import { useGapInsert } from '../composables/useGapInsert'

// === 数据源状态 ===
const commonComponentsList = ref([])
const componentTypes = ref([])

const showModal = ref(false)
const isEditMode = ref(false)
const formData = ref({ id: null, name: '', type: '', file: null, existingUrl: '', insertBefore: null, insertAfter: null })

// === 缝隙插入微交互 (composable) ===
const currentList = computed(() => commonComponentsList.value)

const fetchData = async () => {
    try {
        const res = await axios.get(`${API_BASE}/common-components`)
        commonComponentsList.value = res.data
    } catch (err) {
        showToast('❌ 加载百宝箱失败')
    }
}

const {
    isSorting, expandedGap, shiftedCards, cardStatuses,
    updateRowStatuses, expandGap, collapseGap,
    handleGapMouseEnter, handleGapMouseLeave, handleGapClick,
    moveItem, toggleSortingMode, initResizeObserver, destroy
} = useGapInsert({
    getCurrentList: () => commonComponentsList.value,
    tableName: 'common_components',
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

const openAddModal = (gapConfig = null) => {
    isEditMode.value = false
    formData.value = {
        id: null, name: '', type: '', file: null, existingUrl: '',
        insertBefore: gapConfig?.side === 'left' ? gapConfig.id : null,
        insertAfter: gapConfig?.side === 'right' ? gapConfig.id : null
    }
    showModal.value = true
}

const handleItemClick = (item) => {
    if (isSorting.value) return
    if (item.is_system) {
        showToast('⚠️ 世界法则保护：系统内置组件无法修改！')
        return
    }
    isEditMode.value = true
    formData.value = { id: item.id, name: item.name, type: item.type, file: null, existingUrl: item.icon_url, insertBefore: null, insertAfter: null }
    showModal.value = true
}

const onGapConfirm = (gapConfig) => {
    openAddModal(gapConfig)
}

const onUploadUpdate = (val) => {
  Object.assign(formData.value, val)
}

// === 表单提交 ===
const submitForm = async () => {
    if (!formData.value.name) return showToast('❌ 必须有名字！')
    if (!formData.value.type) return showToast('❌ 请选择组件部位！')

    let finalIconUrl = formData.value.existingUrl || '❓'
    if (formData.value.file) {
        try {
            const fileData = new FormData()
            fileData.append('file', formData.value.file)
            const uploadRes = await axios.post(`${API_BASE}/upload?target=common_components`, fileData)
            finalIconUrl = uploadRes.data.url
        } catch (err) {
            const msg = err.response?.data?.error || err.message || '上传失败'
            return showToast(`❌ ${msg}`)
        }
    }

    const endpoint = `${API_BASE}/common-components`
    const payload = {
        name: formData.value.name,
        type: formData.value.type,
        icon_url: finalIconUrl
    }

    if (!isEditMode.value) {
        if (formData.value.insertAfter) payload.insert_after_id = formData.value.insertAfter
        if (formData.value.insertBefore) payload.insert_before_id = formData.value.insertBefore
    }

    try {
        if (isEditMode.value) {
            await axios.put(`${endpoint}/${formData.value.id}`, payload)
            showToast('✨ 通用组件重铸成功！')
        } else {
            await axios.post(endpoint, payload)
            showToast('🔨 通用组件锻造成功！')
        }
        showModal.value = false
        await fetchData()
    } catch (err) {
        showToast('❌ 操作失败，请检查网络！')
    }
}

const deleteItem = async () => {
    if (!confirm('⚠️ 确认要永久销毁此通用资产吗？所有关联套装的相关显示都将回滚。')) return
    try {
        await axios.delete(`${API_BASE}/common-components/${formData.value.id}`)
        showToast('🗑️ 通用组件已被彻底摧毁！')
        showModal.value = false
        await fetchData()
    } catch (error) {
        showToast('❌ 销毁失败。')
    }
}
</script>

<style scoped>
.chest-container {
    height: 100%;
    position: relative;
}
.chest-main {
    height: 100%;
    display: flex;
    flex-direction: column;
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
    border-color: #00ff66;
    /* 独特的共享卡边框高亮 */
}

.system-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 10;
}

/* 独特的百宝箱卡片小水印 */
.global-link-tag {
    position: absolute;
    top: 5px;
    right: 5px;
    font-size: 12px;
    opacity: 0.3;
    z-index: 10;
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

/* 缝隙插空样式 */
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
    background: #00ff66;
    color: #000;
    border: 1px solid #fff;
    font-size: 10px;
    font-weight: bold;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 5px #00ff66;
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
.sorting-fever .item-card {
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

/* 模态框及响应式 */
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

@media (max-width: 768px) {
    .header-tools {
        flex-direction: row;
        align-items: center;
        gap: 6px;
    }
    .grid-area {
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        padding: 10px;
        width: 100%;
        padding-left: 15px;
        padding-right: 15px;
    }
    .chest-main {
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
}
</style>