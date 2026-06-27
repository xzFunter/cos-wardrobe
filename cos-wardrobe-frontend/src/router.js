import {
    createRouter,
    createWebHistory
} from 'vue-router'
import Login from './views/Login.vue'
import MainLayout from './layout/MainLayout.vue' // 新建的母版
import Inventory from './views/Inventory.vue'
import Office from './views/Office.vue' // 新建的办公室
import ModelSetup from './views/ModelSetup.vue'
import Forge from './views/Forge.vue' // 锻造车间
import Display from './views/Display.vue' // 锻造车间
import Chest from './views/Chest.vue' // 锻造车间

const routes = [{
        path: '/',
        component: Login
    },
    {
        path: '/app',
        component: MainLayout,
        children: [{
                path: 'inventory',
                component: Inventory
            }, // 装备仓库
            {
                path: 'office',
                component: Office
            }, // 酒馆办公室
            {
                path: 'model-setup/:id',
                component: ModelSetup
            },
            {
                path: 'forge/:id?',
                name: 'Forge',
                component: Forge
            }, // 锻造工坊 (id 可选，无 id 为新增，有 id 为编辑)
            {
                path: 'display/:id',
                name: 'Display',
                component: Display
            },
            {
                path: 'chest',
                name: 'Chest',
                component: Chest
            }
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// 路由守卫：未登录自动跳回酒馆大门
router.beforeEach((to, from, next) => {
    const userId = localStorage.getItem('currentUserId');
    if (to.path.startsWith('/app') && !userId) {
        next('/');
    } else {
        next();
    }
});

export default router