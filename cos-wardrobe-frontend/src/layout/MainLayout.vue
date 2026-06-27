<template>
  <div class="app-layout">

    <transition name="toast-fade">
      <div v-if="toastMessage" class="game-toast nes-container is-dark with-title">
        <p class="title">系统公告</p>
        <p>{{ toastMessage }}</p>
      </div>
    </transition>

    <aside :class="['sidebar nes-container is-dark', { 'is-collapsed': isCollapsed }]">

      <button class="nes-btn is-primary toggle-tab" @click="isCollapsed = !isCollapsed">
        {{ isCollapsed ? '▶' : '◀' }}
      </button>

      <div class="sidebar-content">
        <div class="user-panel">
          <p class="nes-text is-success">{{ userName }}</p>
          <button class="nes-btn is-error is-small" @click="logout">退出酒馆</button>
        </div>

        <nav class="sidebar-nav">
          <router-link to="/app/forge" class="nes-btn nav-btn" @click="autoClose">🔨 锻造装备</router-link>
          <router-link to="/app/inventory" class="nes-btn nav-btn" @click="autoClose">🎒 装备仓库</router-link>
          <button class="nes-btn nav-btn" @click="handleTavernClick">
            🎭 酒馆舞台
          </button>
          <router-link to="/app/chest" class="nes-btn nav-btn" @click="autoClose">🧰 百宝箱</router-link>
          <router-link to="/app/office" class="nes-btn nav-btn" @click="autoClose">📜 酒馆办公室</router-link>
        </nav>
      </div>
    </aside>

    <main class="main-content">
      <router-view />
    </main>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toastMessage } from '../utils/toast'
import { showToast } from '../utils/toast'
import axios from 'axios';
import { API_BASE, ASSET_BASE } from '../utils/api'

const isCollapsed = ref(true) // 考虑到手机端体验，初始状态设为收起比较好
const userName = localStorage.getItem('currentUserName') || '未知勇者'
const router = useRouter()

const logout = () => {
  localStorage.clear()
  router.push('/')
}

// 导航跳转后自动收起侧边栏（优化移动端体验）
const autoClose = () => {
  // 如果你需要保持 PC 端一直展开，可以加个屏幕宽度判断：
  // if (window.innerWidth < 768) isCollapsed.value = true
  isCollapsed.value = true
}

const handleTavernClick = async () => {
  autoClose();

  const userId = localStorage.getItem('currentUserId') || 1;

  try {
    // 1. 请求后端获取用户最新的足迹
    const res = await axios.get(`${API_BASE}/users/${userId}`);
    const lastId = res.data.last_visited_costume_id;

    // 2. 根据数据库返回的记录进行跳转
    if (lastId) {
      router.push(`/app/display/${lastId}`);
    } else {
      router.push('/app/inventory'); // 没有记录去列表页
      showToast('无上次访问记录，请先访问一套cos套装')
    }
  } catch (error) {
    console.error('获取用户足迹失败', error);
    showToast('❌ 获取用户足迹失败')
    // 3. 兜底逻辑：如果接口挂了，默认安全去列表页
    router.push('/app/inventory');
  }
};

</script>

<style scoped>
/* ===== 基础布局 ===== */
.app-layout {
  position: relative;
  width: 100vw;
  height: 100vh;
  background-color: #1a1a1a;
  overflow: hidden;
}

/* ===== 主内容区 (铺满底层) ===== */
.main-content {
  position: absolute;
  /* 绝对定位，强行钉在左上角，不受侧边栏任何影响 */
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  /* 防止 padding 把内容撑出屏幕 */
}

/* ===== 半透明遮罩 ===== */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 998;
  backdrop-filter: blur(2px);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* ===== 侧边栏 (强行脱离文档流) ===== */
.sidebar {
  position: fixed !important;
  /* 核心修复：防止被 nes-container 覆盖 */
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  margin: 0 !important;
  /* 清除默认外边距 */
  z-index: 999;
  border-right: 4px solid #fff;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.is-collapsed {
  transform: translateX(-100%);
}

/* ===== 悬浮箭头便签 ===== */
.toggle-tab {
  position: absolute;
  top: 20px;
  right: -52px;
  width: 52px;
  height: 52px;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

/* ===== 侧边栏内部内容排版 ===== */
.sidebar-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 15px;
  /* 给内部加一点内边距，更美观 */
}

.user-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 20px;
  margin-bottom: 20px;
  border-bottom: 2px dashed #555;
  text-align: center;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.nav-btn {
  text-align: left;
  font-size: 14px;
}

.router-link-active {
  background-color: #209cee !important;
  color: #fff !important;
}
/* === 游戏风顶部浮窗 (Toast) 样式 === */
.game-toast {
  position: fixed;
  /* 绝对定位在容器顶部 */
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  background-color: rgba(0, 0, 0, 0.9);
  color: #fff;
  border: 4px solid #ffd700;
  /* 金色边框凸显提示 */
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
  min-width: 300px;
  text-align: center;
}
.game-toast p {
  margin: 0;
  padding: 5px;
}
/* 动画过渡 */
.toast-fade-enter-active, .toast-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  top: -50px;
  transform: translateX(-50%) scale(0.8);
}
</style>