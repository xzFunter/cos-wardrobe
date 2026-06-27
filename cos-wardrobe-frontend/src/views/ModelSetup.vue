<template>
    <div class="blueprint-container">

        <div class="rpg-header nes-container is-dark with-title">
            <p class="title">蓝图工作室</p>
            <div class="header-content">
                <div class="title-box">
                    <span>模特：</span>
                    <span class="nes-text is-warning">{{ modelData.name || '加载中...' }}</span>
                    <span v-if="modelData.is_system" class="nes-text is-error"
                        style="margin-left: 10px;">[世界法则保护]</span>
                </div>

                <!-- 🌟 优化后的顶部动态矩阵操作台 🌟 -->
                <div class="action-buttons-grid" :class="{ 'has-four-btns': modelData.id && !modelData.is_system }">
                    <!-- 按钮 1：返回 -->
                    <button class="nes-btn" @click="goBack">↩️ 返回办公室</button>

                    <!-- 按钮 2：编辑 (自定义模型专享) -->
                    <button v-if="modelData.id && !modelData.is_system" class="nes-btn is-warning"
                        @click="openEditModal">
                        🛠️ 编辑信息
                    </button>

                    <!-- 按钮 3：保存蓝图 -->
                    <button class="nes-btn is-primary" @click="saveLayout">💾 铭刻蓝图</button>

                    <!-- 按钮 4：销毁 (自定义模型专享) -->
                    <button v-if="modelData.id && !modelData.is_system" class="nes-btn is-error" @click="deleteModel">
                        🗑️ 销毁模具
                    </button>
                </div>
            </div>
        </div>

        <div class="workspace">
            <div class="component-toolbox nes-container is-dark">
                <p style="text-align: center; color: #aaa; margin-bottom: 5px;">可用组件节点</p>
                <div class="toolbox-list hide-scrollbar">
                    <div v-for="comp in componentsList" :key="comp.id"
                        :class="['toolbox-item nes-pointer', { 'is-highlighted': isAdded(comp) }]"
                        @click="addNodeToCanvas(comp)">
                        <div class="comp-mini-icon">
                            <img v-if="isUrl(comp.icon_url)" :src="getAssetUrl(comp.icon_url)" class="pixel-render" />
                            <span v-else>{{ comp.icon_url }}</span>
                        </div>
                        <div class="comp-mini-info">
                            <span class="nes-text is-warning" style="font-size: 10px;">[{{ comp.type }}]</span>
                            <span style="font-size: 12px; display: block;">{{ comp.name }}</span>
                        </div>
                        <div v-if="isAdded(comp)" class="status-added">✔</div>
                        <div v-else class="add-btn">➕</div>
                    </div>
                </div>
            </div>

            <div class="canvas-area">
                <VueFlow v-model:nodes="nodes" v-model:edges="edges" :fit-view-on-init="true"
                    :default-edge-options="{ type: 'default', animated: true, style: { stroke: '#ffd700', strokeWidth: 3 } }"
                    :elevate-nodes-on-select="false" @connect="onConnect">
                    <Background pattern-color="#444" :gap="20" :size="2" />

                    <template #node-model="nodeProps">
                        <div class="pixel-model-node">
                            <div class="model-placeholder"
                                @click="addCustomHandle($event, nodeProps.data, nodeProps.id)" title="点击空白处添加挂载点">
                                <Handle v-for="handle in (nodeProps.data.customHandles || [])" :key="handle.id"
                                    :id="handle.id" type="target" :position="handle.position"
                                    class="rpg-handle custom-handle"
                                    :style="{ top: handle.y + '%', left: handle.x + '%' }" :connectable="true"
                                    :connectable-start="false" @click.stop
                                    @dblclick.prevent.stop="cycleHandleDirection(handle, nodeProps.data, nodeProps.id)">
                                    <div v-if="handle.showArrow" :class="['direction-arrow', handle.position]">
                                        ▲
                                    </div>
                                </Handle>

                                <img v-if="isUrl(nodeProps.data.image_url)" :src="getAssetUrl(nodeProps.data.image_url)"
                                    class="pixel-render model-image" />
                                <span v-else class="emoji-huge model-image">{{ nodeProps.data.image_url }}</span>
                            </div>
                        </div>
                    </template>

                    <template #node-component="nodeProps">
                        <div class="pixel-component-box">
                            <Handle id="source-top" type="source" :position="Position.Top" class="rpg-handle" />
                            <Handle id="source-bottom" type="source" :position="Position.Bottom" class="rpg-handle" />
                            <Handle id="source-left" type="source" :position="Position.Left" class="rpg-handle" />
                            <Handle id="source-right" type="source" :position="Position.Right" class="rpg-handle" />

                            <button class="remove-node-btn" @click.stop="removeNode(nodeProps.id)">✖</button>
                            <div class="comp-icon">
                                <img v-if="isUrl(nodeProps.data.icon)" :src="getAssetUrl(nodeProps.data.icon)"
                                    class="pixel-render" />
                                <span v-else class="emoji-large">{{ nodeProps.data.icon }}</span>
                            </div>
                            <div class="comp-info">
                                <div class="status-tag nes-text is-warning">[{{ nodeProps.data.type }}]</div>
                                <div class="comp-name">{{ nodeProps.label }}</div>
                            </div>
                        </div>
                    </template>
                </VueFlow>
            </div>
        </div>

        <!-- 🌟 沉浸式：重铸信息模态框 (与新增逻辑拉齐) 🌟 -->
        <div class="modal-overlay" v-if="showEditModal">
            <div class="nes-dialog is-dark modal-box">
                <p class="title" style="margin-bottom: 20px; font-size: 20px;">重铸模特信息</p>

                <div class="nes-field form-group">
                    <label>模特名称</label>
                    <input type="text" class="nes-input is-dark" v-model="editFormData.name" placeholder="输入名称...">
                </div>

                <div class="nes-field form-group upload-area">
                    <label>资产图片 / Emoji</label>
                    <div class="preview-box" v-if="editFormData.file || editFormData.existingUrl">
                        <span class="nes-text is-success">已就绪: {{ editFormData.file ? '待上传图片 (已压缩)' :
                            editFormData.existingUrl
                        }}</span>
                    </div>
                    <input type="file" ref="cameraInput" @change="handleFileSelect" accept="image/*"
                        capture="environment" style="display: none;" />
                    <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*"
                        style="display: none;" />

                    <div class="action-buttons" style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <button class="nes-btn is-success" style="flex: 1;" @click="() => fileInput.click()">📁
                            选图</button>
                        <button class="nes-btn is-error" style="flex: 1;" @click="() => cameraInput.click()">📷
                            拍照</button>
                    </div>
                    <button class="nes-btn is-warning clip-btn" @click="handleClipboard">📋 读取剪贴板内容</button>
                </div>

                <div class="dialog-menu" style="display: flex; margin-top: 30px; justify-content: flex-end; gap: 15px;">
                    <button class="nes-btn" @click="showEditModal = false">取消</button>
                    <button class="nes-btn is-primary" @click="submitEditForm">保存重铸</button>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { showToast } from '../utils/toast'
import { VueFlow, useVueFlow, Handle, Position } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { API_BASE, ASSET_BASE } from '../utils/api'
import { isUrl, getAssetUrl } from '../utils/asset'
import { compressImage, readClipboard } from '../utils/image'

const route = useRoute()
const router = useRouter()

const modelData = ref({})
const componentsList = ref([])
const nodes = ref([])
const edges = ref([])
const { toObject, updateNodeInternals } = useVueFlow()

// 🌟 新增：重铸模态框专有状态 🌟
const showEditModal = ref(false)
const fileInput = ref(null)
const cameraInput = ref(null)
const editFormData = ref({ name: '', file: null, existingUrl: '' })

// 判定组件是否已在画布中
const isAdded = (comp) => {
    return nodes.value.some(n => n.data && n.data.componentId === comp.id)
}

onMounted(async () => {
    const modelId = route.params.id

    try {
        const [modelRes, compRes] = await Promise.all([
            axios.get(`${API_BASE}/models/${modelId}`),
            axios.get(`${API_BASE}/components`)
        ])
        modelData.value = modelRes.data
        componentsList.value = compRes.data

        // 组件模板 Map 用于实时同步连线图上已有节点的名称/图标
        const componentTemplatesMap = new Map(compRes.data.map(c => [c.id, c]))

        if (modelData.value.layout_data) {
            const savedGraph = JSON.parse(modelData.value.layout_data)
            // 实时同步已有节点的数据
            nodes.value = (savedGraph.nodes || []).map(n => {
                if (n.type === 'component' && n.data && n.data.componentId) {
                    const latest = componentTemplatesMap.get(n.data.componentId)
                    if (latest) {
                        n.label = latest.name
                        n.data.icon = latest.icon_url
                        n.data.type = latest.type
                    }
                }
                return n
            })
            edges.value = savedGraph.edges || []

            const modelNode = nodes.value.find(n => n.type === 'model')
            if (modelNode) {
                modelNode.draggable = false
                modelNode.zIndex = -1
            }
        } else {
            nodes.value = [{
                id: `model-${modelId}`,
                type: 'model',
                position: { x: 300, y: 100 },
                draggable: false,
                zIndex: -1,
                data: { name: modelData.value.name, image_url: modelData.value.image_url, customHandles: [] }
            }]
        }
    } catch (err) {
        showToast('❌ 加载蓝图失败！')
    }
})

// === 画布核心逻辑保持不变 ===
const addNodeToCanvas = (comp) => {
    const newNodeId = `comp-${comp.id}-${Date.now()}`
    // 使用最新的组件模板数据
    const latest = componentsList.value.find(c => c.id === comp.id) || comp
    nodes.value.push({
        id: newNodeId,
        type: 'component',
        label: latest.name,
        position: { x: Math.random() * 100 + 50, y: Math.random() * 200 + 50 },
        zIndex: 10,
        data: { icon: latest.icon_url, type: latest.type, componentId: latest.id }
    })
}

const removeNode = (nodeId) => {
    nodes.value = nodes.value.filter(n => n.id !== nodeId)
    edges.value = edges.value.filter(e => e.source !== nodeId && e.target !== nodeId)
}

const onConnect = (connection) => {
    edges.value.push({
        id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'default',
        animated: true,
        style: { stroke: '#ffd700', strokeWidth: 3 },
        zIndex: 50
    })
}

const addCustomHandle = async (event, data, nodeId) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    const dists = [
        { pos: Position.Top, dist: y },
        { pos: Position.Bottom, dist: 100 - y },
        { pos: Position.Left, dist: x },
        { pos: Position.Right, dist: 100 - x }
    ]
    const optimal = dists.reduce((prev, curr) => prev.dist < curr.dist ? prev : curr)

    if (!data.customHandles) data.customHandles = []

    data.customHandles.push({
        id: `target-custom-${Date.now()}`,
        x, y, position: optimal.pos, cycleStep: 0, showArrow: false, arrowTimeout: null
    })

    await nextTick()
    updateNodeInternals(nodeId)
}

const directionCycle = [Position.Top, Position.Bottom, Position.Left, Position.Right, 'delete']
const cycleHandleDirection = async (handle, nodeData, nodeId) => {
    const nextState = directionCycle[handle.cycleStep]
    if (nextState === 'delete') {
        nodeData.customHandles = nodeData.customHandles.filter(h => h.id !== handle.id)
        if (edges.value) edges.value = edges.value.filter(e => e.targetHandle !== handle.id)
    } else {
        handle.position = nextState
        handle.cycleStep++
        handle.showArrow = true
        if (handle.arrowTimeout) clearTimeout(handle.arrowTimeout)
        handle.arrowTimeout = setTimeout(() => { handle.showArrow = false }, 1000)

        await nextTick()
        updateNodeInternals(nodeId)
    }
}

const saveLayout = async () => {
    const graphData = toObject()
    try {
        await axios.put(`${API_BASE}/models/${modelData.value.id}/layout`, {
            layout_data: JSON.stringify(graphData)
        })
        showToast('✨ 蓝图已永久铭刻入数据库！')
    } catch (err) {
        showToast('❌ 保存失败。')
    }
}

const deleteModel = async () => {
    if (!confirm('⚠️ 确认要永久销毁此模特吗？此操作无法撤销！')) return
    try {
        await axios.delete(`${API_BASE}/models/${modelData.value.id}`)
        showToast('🗑️ 模特已被彻底销毁！')
        router.push('/app/office')
    } catch (error) {
        showToast('❌ 销毁失败。')
    }
}

const goBack = () => {
    router.push('/app/office')
}

// ====== 🌟 新增：重铸控制台魔法 ======
const openEditModal = () => {
    editFormData.value = {
        name: modelData.value.name,
        file: null,
        existingUrl: modelData.value.image_url
    }
    showEditModal.value = true
}

const handleFileSelect = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    editFormData.value.file = await compressImage(file)
    editFormData.value.existingUrl = ''
}

const handleClipboard = () => {
    readClipboard(
        (compressedFile) => {
            editFormData.value.file = compressedFile
            editFormData.value.existingUrl = ''
        },
        (text) => {
            editFormData.value.existingUrl = text
            editFormData.value.file = null
        }
    )
}

const submitEditForm = async () => {
    if (!editFormData.value.name) return showToast('❌ 模具不能没有名字！')

    let finalImageUrl = editFormData.value.existingUrl
    if (editFormData.value.file) {
        try {
            const fileData = new FormData()
            fileData.append('file', editFormData.value.file)
            const uploadRes = await axios.post(`${API_BASE}/upload?target=models`, fileData)
            finalImageUrl = uploadRes.data.url
        } catch (err) {
            const msg = err.response?.data?.error || err.message || '上传失败'
            return showToast(`❌ ${msg}`)
        }
    }

    try {
        await axios.put(`${API_BASE}/models/${modelData.value.id}`, {
            name: editFormData.value.name,
            image_url: finalImageUrl
        })
        showToast('✨ 模具重铸成功，蓝图已同步渲染！')
        showEditModal.value = false

        // 🌟 沉浸式更新：无刷新替换顶栏和画板里的图像 🌟
        modelData.value.name = editFormData.value.name
        modelData.value.image_url = finalImageUrl

        const modelNode = nodes.value.find(n => n.type === 'model')
        if (modelNode) {
            modelNode.data.name = editFormData.value.name
            modelNode.data.image_url = finalImageUrl

            // 通知 Vue Flow 强制重绘，防止连接错位
            await nextTick()
            updateNodeInternals(modelNode.id)
        }
    } catch (err) {
        showToast('❌ 重铸失败')
    }
}
</script>

<style scoped>
.blueprint-container {
    display: flex;
    flex-direction: column;
    height: 100%;
}
.rpg-header {
    margin-bottom: 15px;
    padding: 5px;
    border-style: hidden
}
.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.title-box {
    background: #000;
    padding: 8px 16px;
    border: 2px solid #fff;
}

/* 🌟 控制台矩阵核心样式 🌟 */
.action-buttons-grid {
    display: grid;
    /* 普通情况(系统组件): 2列等分; 自定义组件(带有.has-four-btns类): 4列等分 */
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
}
.action-buttons-grid.has-four-btns {
    grid-template-columns: repeat(4, 1fr);
}
.action-buttons-grid .nes-btn {
    width: 100%;
    white-space: nowrap;
    text-align: center;
}

.workspace {
    flex: 1;
    display: flex;
    gap: 15px;
    min-height: 0;
}

/* 左侧工具箱 */
.component-toolbox {
    width: 260px;
    display: flex;
    flex-direction: column;
    padding: 15px 10px;
    overflow-y: auto;
}
.toolbox-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.toolbox-item {
    display: flex;
    align-items: center;
    background: #222;
    border: 2px solid #555;
    padding: 8px;
    transition: transform 0.1s, border-color 0.1s;
}
.toolbox-item:hover {
    transform: translateX(5px);
    border-color: #ffd700;
}
.comp-mini-icon {
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #000;
    margin-right: 10px;
}
.comp-mini-icon img {
    max-width: 32px;
    max-height: 32px;
}
.comp-mini-icon span {
    font-size: 24px;
}
.comp-mini-info {
    flex: 1;
}
.add-btn {
    background: #000;
    border: 1px solid #fff;
    width: 30px;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* 高亮样式 */
.toolbox-item.is-highlighted {
    background-color: #f7d51d !important;
    color: #000;
    border-color: #000 !important;
}
.toolbox-item.is-highlighted .nes-text {
    color: #000 !important;
}
.status-added {
    font-weight: bold;
    font-size: 16px;
    color: #000;
}

/* 右侧画布 */
.canvas-area {
    flex: 1;
    background: #111;
    border: 4px solid #fff;
    position: relative;
}

/* 画布内节点样式 */
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
    cursor: crosshair;
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
    border: 3px solid #fff;
    padding: 8px;
    min-width: 150px;
    position: relative;
}
.remove-node-btn {
    position: absolute;
    top: -10px;
    right: -10px;
    background: #f44336;
    color: white;
    border: 2px solid #fff;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
}
.comp-icon {
    width: 40px;
    height: 40px;
    background: #000;
    border: 1px solid #555;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 12px;
}
.comp-icon img {
    max-width: 32px;
    max-height: 32px;
}
.emoji-large {
    font-size: 32px;
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

/* 游戏风 Handle 样式 */
:deep(.rpg-handle) {
    width: 12px;
    height: 12px;
    background-color: #ffd700;
    border: 2px solid #fff;
    border-radius: 0;
    box-shadow: 0 0 5px #ffd700;
    transition: transform 0.2s;
}
:deep(.rpg-handle:hover) {
    transform: scale(1.5);
    background-color: #fff;
}
:deep(.custom-handle) {
    position: absolute !important;
    transform: translate(-50%, -50%) !important;
    margin: 0 !important;
    z-index: 20;
}

/* 重铸模态框专有样式 */
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


/* ===== 移动端适配：蓝图工作室 ===== */
@media (max-width: 768px) {
    /* 顶部操作区改为竖向堆叠与网格约束 */
    .header-content {
        flex-direction: column;
        gap: 5px;
        align-items: stretch;
    }

    /* 🌟 移动端 2x2 黄金重组布局 🌟 */
    .action-buttons-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        row-gap: 2px;
        column-gap: 15px;
    }
    .action-buttons-grid .nes-btn {
        font-size: 11px !important;
        padding: 8px 4px !important;
    }

    /* 核心：将左右布局改为上下布局 */
    .workspace {
        flex-direction: column;
    }

    /* 工具箱变成横向滚动的快捷物品栏 */
    .component-toolbox {
        width: 100%;
        height: 120px;
        padding: 5px;
        overflow-y: hidden;
    }
    .toolbox-list {
        flex-direction: row;
        overflow-x: auto;
        padding-bottom: 10px;
    }
    .toolbox-item {
        min-width: 180px;
        margin-right: 10px;
    }

    /* 画布高度自动撑满剩余空间 */
    .canvas-area {
        min-height: 400px;
    }

    /* 模态框极限压缩 */
    .modal-box {
        width: 90vw !important;
        padding: 15px;
    }
}

/* 箭头指示器：绝对居中再向外推算 */
.direction-arrow {
    position: absolute;
    color: #ffd700;
    font-size: 14px;
    pointer-events: none;
    transition: all 0.1s;
    z-index: 50;
    text-shadow: 0 0 3px #000;

    /* 先让箭头对准锚点的正中心 */
    left: 50%;
    top: 50%;
    margin-left: -7px;
    margin-top: -10px;
}

.direction-arrow.top {
    transform: translateY(-20px) rotate(0deg);
}
.direction-arrow.bottom {
    transform: translateY(20px) rotate(180deg);
}
.direction-arrow.left {
    transform: translateX(-20px) rotate(-90deg);
}
.direction-arrow.right {
    transform: translateX(20px) rotate(90deg);
}
</style>