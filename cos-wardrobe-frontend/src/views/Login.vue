<template>
  <div class="tavern-container">
    <div class="nes-container is-dark with-title tavern-box">
      <p class="title">勇者装备公会 - 酒馆大门</p>
      <p class="welcome-text">请选择你要读取的存档：</p>

      <div class="user-list">
        <button v-for="user in users" :key="user.id" class="nes-btn is-primary user-btn" @click="selectUser(user)">
          <span class="emoji-avatar">{{ user.avatar }}</span>
          {{ user.username }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE } from '../utils/api'

const users = ref([])
const router = useRouter()

onMounted(async () => {
  // 2. 替换写死的 localhost
  try {
    const res = await axios.get(`${API_BASE}/users`)
    users.value = res.data
  } catch (error) {
    console.error("无法连接到公会后端服务器：", error)
    alert("网络连接失败，请检查电脑防火墙或后端是否运行！")
  }
})

const selectUser = (user) => {
  localStorage.setItem('currentUserId', user.id)
  localStorage.setItem('currentUserName', user.username)
  router.push('/app/inventory')
}
</script>

<style scoped>
.tavern-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #121212;
  background-image: radial-gradient(#333 1px, transparent 1px);
  background-size: 20px 20px;
}
.tavern-box {
  width: 500px;
  text-align: center;
  background-color: #212529;
}
.welcome-text {
  margin-bottom: 30px;
  color: #fff;
}
.user-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.user-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  padding: 10px;
}
.emoji-avatar {
  font-size: 30px;
  margin-right: 15px;
}
</style>