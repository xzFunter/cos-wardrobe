const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(cors({
    origin: function (origin, callback) {
        // 允许本地开发、局域网、以及无 origin 的请求（如移动端 App）
        if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.')) {
            callback(null, true);
        } else {
            // 原型阶段保持宽松，生产环境需要收紧
            callback(null, true);
        }
    }
}));
app.use(express.json());

// 1. 读取系统配置
const configPath = path.join(__dirname, 'system_config.json');
const systemConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 2. 自动化构建资产目录树 (Assets)
const assetConfig = systemConfig.asset_paths;
const baseAssetDir = path.join(__dirname, assetConfig.base_dir);
if (!fs.existsSync(baseAssetDir)) fs.mkdirSync(baseAssetDir);

// 遍历并创建配置里的子文件夹
Object.values(assetConfig.directories).forEach(dirName => {
    const fullPath = path.join(baseAssetDir, dirName);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath);
});

// 开放 assets 目录为静态资源
app.use('/assets', express.static(baseAssetDir));

// 3. 智能文件分发配置 (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 根据前端传来的 target 参数匹配 JSON 里的文件夹名称
        const targetKey = req.query.target;
        const subDirName = assetConfig.directories[targetKey] || '';
        const finalPath = path.join(baseAssetDir, subDirName);
        cb(null, finalPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 上传上限
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('仅允许上传图片文件 (JPEG, PNG, GIF, WebP)'));
        }
    }
});

// 4. 数据库初始化与数据覆写机制
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, avatar TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS user_costumes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, cover_url TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS model_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, image_url TEXT, is_system INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS component_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, icon_url TEXT, is_system INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS common_components (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,type TEXT NOT NULL, icon_url TEXT, is_system INTEGER DEFAULT 0)`);

    db.run(`CREATE TABLE IF NOT EXISTS origins (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE)`);


    // 拔高自定义数据的 ID 起始值到 10000
    db.run("INSERT OR IGNORE INTO model_templates (id, name, is_system) VALUES (10000, 'dummy', 0)");
    db.run("DELETE FROM model_templates WHERE id = 10000");
    db.run("INSERT OR IGNORE INTO component_templates (id, name, is_system) VALUES (10000, 'dummy', 0)");
    db.run("DELETE FROM component_templates WHERE id = 10000");
    db.run("INSERT OR IGNORE INTO common_components (id, name, is_system) VALUES (10000, 'dummy', 0)");
    db.run("DELETE FROM common_components WHERE id = 10000");

    // 每次启动清空现有的内置数据，再从 JSON 重新植入
    db.run("DELETE FROM model_templates WHERE is_system = 1");
    db.run("DELETE FROM component_templates WHERE is_system = 1");
    db.run("DELETE FROM common_components WHERE is_system = 1");

    // 给模特表增加一个存放画布连线数据的字段
    db.run("ALTER TABLE model_templates ADD COLUMN layout_data TEXT", (err) => {});

    // 给旧的套装表打上扩充补丁（允许报错，因为如果列已存在会抛错，忽略即可）
    db.run("ALTER TABLE user_costumes ADD COLUMN origin TEXT", (err) => {});
    db.run("ALTER TABLE user_costumes ADD COLUMN model_id INTEGER", (err) => {});
    db.run("ALTER TABLE user_costumes ADD COLUMN components_data TEXT", (err) => {});

    db.run("ALTER TABLE user_costumes ADD COLUMN sort_order INTEGER DEFAULT 0", (err) => {});
    db.run("ALTER TABLE model_templates ADD COLUMN sort_order INTEGER DEFAULT 0", (err) => {});
    db.run("ALTER TABLE component_templates ADD COLUMN sort_order INTEGER DEFAULT 0", (err) => {});
    db.run("ALTER TABLE common_components ADD COLUMN sort_order INTEGER DEFAULT 0", (err) => {});

    db.run("ALTER TABLE users ADD COLUMN last_visited_costume_id INTEGER DEFAULT 0", (err) => {});

    const {
        model_templates,
        component_templates,
        common_components
    } = systemConfig.seed_data;

    const stmtModel = db.prepare("INSERT INTO model_templates (id, name, image_url, is_system) VALUES (?, ?, ?, 1)");
    model_templates.forEach(m => stmtModel.run(m.id, m.name, m.image_url));
    stmtModel.finalize();

    const stmtComp = db.prepare("INSERT INTO component_templates (id, name, type, icon_url, is_system) VALUES (?, ?, ?, ?, 1)");
    component_templates.forEach(c => stmtComp.run(c.id, c.name, c.type, c.icon_url));
    stmtComp.finalize();

    const stmtCommonComp = db.prepare("INSERT INTO common_components (id, name, type, icon_url, is_system) VALUES (?, ?, ?, ?, 1)");
    common_components.forEach(c => stmtCommonComp.run(c.id, c.name, c.type, c.icon_url));
    stmtCommonComp.finalize();

    // 检查并添加 description 列，如果已经存在则会自动忽略
    const addColumn = (tableName) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
            const hasDescription = rows.some(row => row.name === 'description');
            if (!hasDescription) {
                db.run(`ALTER TABLE ${tableName} ADD COLUMN description TEXT`, (err) => {
                    if (err) console.error(`补全 ${tableName} 失败:`, err.message);
                    else console.log(`已成功为 ${tableName} 添加 description 列`);
                });
            }
        });
    };

    addColumn('model_templates');
    addColumn('component_templates');
    addColumn('common_components');

    // 基础用户数据兜底
    db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
        if (row && row.count === 0) {
            const {
                users,
                test_costumes
            } = systemConfig.seed_data;
            const stmtUser = db.prepare("INSERT INTO users (id, username, avatar) VALUES (?, ?, ?)");
            users.forEach(u => stmtUser.run(u.id, u.username, u.avatar));
            stmtUser.finalize();
            const stmtCostume = db.prepare("INSERT INTO user_costumes (user_id, name, cover_url) VALUES (?, ?, ?)");
            test_costumes.forEach(c => stmtCostume.run(c.user_id, c.name, c.cover_url));
            stmtCostume.finalize();
        }
    });
    console.log('世界法则与内置系统数据已同步覆写完成！');
});

// ====================
// 通用插空排序工具函数
// ====================

/**
 * 在指定位置插入记录并自动管理 sort_order
 * @param {string} table - 表名
 * @param {string} columns - 列名字符串（不含 sort_order）
 * @param {Array} values - 对应值数组（不含 sort_order）
 * @param {string|null} insertAfterId - 插入在哪个 id 之后
 * @param {string|null} insertBeforeId - 插入在哪个 id 之前
 * @param {string} [orderScope] - 可选的 WHERE 条件限定排序范围（如 'user_id = 1'）
 * @param {function} callback - 完成回调 (err, result) result 包含 success 和 id
 */
function insertWithGapOrder(table, columns, values, insertAfterId, insertBeforeId, orderScope, callback) {
    if (insertAfterId) {
        db.get(`SELECT sort_order FROM ${table} WHERE id = ?`, [insertAfterId], (err, row) => {
            if (err || !row) return callback(new Error('插入锚点未找到'));
            const targetOrder = row.sort_order;
            const scope = orderScope ? ` AND ${orderScope}` : '';
            db.run(`UPDATE ${table} SET sort_order = sort_order + 1 WHERE sort_order > ?${scope}`, [targetOrder], (err) => {
                if (err) return callback(err);
                db.run(`INSERT INTO ${table} (${columns}, sort_order) VALUES (${values.map(() => '?').join(', ')}, ?)`,
                    [...values, targetOrder + 1],
                    function(err) {
                        if (err) return callback(err);
                        callback(null, { id: this.lastID });
                    });
            });
        });
    } else if (insertBeforeId) {
        db.get(`SELECT sort_order FROM ${table} WHERE id = ?`, [insertBeforeId], (err, row) => {
            if (err || !row) return callback(new Error('插入锚点未找到'));
            const targetOrder = row.sort_order;
            const scope = orderScope ? ` AND ${orderScope}` : '';
            db.run(`UPDATE ${table} SET sort_order = sort_order + 1 WHERE sort_order >= ?${scope}`, [targetOrder], (err) => {
                if (err) return callback(err);
                db.run(`INSERT INTO ${table} (${columns}, sort_order) VALUES (${values.map(() => '?').join(', ')}, ?)`,
                    [...values, targetOrder],
                    function(err) {
                        if (err) return callback(err);
                        callback(null, { id: this.lastID });
                    });
            });
        });
    } else {
        const scopeCondition = orderScope ? ` WHERE ${orderScope}` : '';
        db.get(`SELECT MAX(sort_order) as max_order FROM ${table}${scopeCondition}`, [], (err, row) => {
            const nextOrder = (row && row.max_order !== null) ? row.max_order + 1 : 0;
            db.run(`INSERT INTO ${table} (${columns}, sort_order) VALUES (${values.map(() => '?').join(', ')}, ?)`,
                [...values, nextOrder],
                function(err) {
                    if (err) return callback(err);
                    callback(null, { id: this.lastID });
                });
        });
    }
}

// ====================
// 通用全局 API 路由
// ====================
app.get('/api/system-config', (req, res) => res.json({
    enums: systemConfig.enums
}));
app.get('/api/users', (req, res) => db.all("SELECT * FROM users", [], (err, rows) => res.json(rows || [])));

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({
        error: '上传失败'
    });
    const targetKey = req.query.target;
    const subDirName = assetConfig.directories[targetKey] || '';
    const fileUrl = `/assets/${subDirName ? subDirName + '/' : ''}${req.file.filename}`;
    res.json({
        url: fileUrl
    });
});


// ==================== 通用批量排序保存接口 ====================
app.post('/api/save-order', (req, res) => {
    const {
        table,
        idList
    } = req.body;

    // 🌟 修正：将验证白名单更改为与真实数据库表名一致 🌟
    if (!['user_costumes', 'model_templates', 'component_templates', 'common_components'].includes(table)) {
        return res.status(400).json({
            error: "非法操作目标"
        });
    }

    // 使用 SQLite 事务进行高效批量更新 (这里由于直接使用了 ${table}，对齐后直接完美运行)
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);

        idList.forEach((id, index) => {
            stmt.run(index, id);
        });

        stmt.finalize();
        db.run("COMMIT", (err) => {
            if (err) return res.status(500).json({
                error: err.message
            });
            res.json({
                success: true
            });
        });
    });
});

// ====================
// 套装 API (Costumes)
// ====================
app.get('/api/costumes', (req, res) => {
    if (!req.query.userId) {
        return res.status(400).json({ error: '缺少 userId 参数' });
    }
    db.all("SELECT * FROM user_costumes WHERE user_id = ? ORDER BY sort_order ASC, id DESC", [req.query.userId], (err, rows) => {
        if (err) {
            console.error('查询套装列表失败:', err.message);
            return res.status(500).json({ error: '数据库查询失败' });
        }
        res.json(rows || []);
    });
});

// 获取单套详情 (用于编辑回显)
app.get('/api/costumes/:id', (req, res) => {
    db.get("SELECT * FROM user_costumes WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error('查询套装详情失败:', err.message);
            return res.status(500).json({ error: '数据库查询失败' });
        }
        if (!row) {
            return res.status(404).json({ error: '套装不存在' });
        }
        res.json(row);
    });
});


// 锻造新套装 (支持行末追加、向后插空、向前插空)
app.post('/api/costumes', (req, res) => {
    const {
        user_id,
        name,
        origin,
        cover_url,
        model_id,
        components_data,
        insert_after_id,
        insert_before_id
    } = req.body;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        if (insert_after_id) {
            // 🌟 场景 1：在指定卡片【之后】插入 (右侧缝隙)
            db.get("SELECT sort_order FROM user_costumes WHERE id = ?", [insert_after_id], (err, row) => {
                if (err || !row) {
                    db.run("ROLLBACK");
                    return res.status(500).json({
                        error: "找不到指定的插入锚点"
                    });
                }
                const targetOrder = row.sort_order;

                // 目标之后的元素全部后移
                db.run("UPDATE user_costumes SET sort_order = sort_order + 1 WHERE user_id = ? AND sort_order > ?", [user_id, targetOrder], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({
                            error: err.message
                        });
                    }

                    db.run(
                        "INSERT INTO user_costumes (user_id, name, origin, cover_url, model_id, components_data, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [user_id, name, origin, cover_url, model_id, components_data, targetOrder + 1],
                        function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({
                                    error: err.message
                                });
                            }
                            db.run("COMMIT");
                            res.json({
                                success: true,
                                id: this.lastID
                            });
                        }
                    );
                });
            });

        } else if (insert_before_id) {
            // 🌟 场景 2：在指定卡片【之前】插入 (仅限行首左侧缝隙)
            db.get("SELECT sort_order FROM user_costumes WHERE id = ?", [insert_before_id], (err, row) => {
                if (err || !row) {
                    db.run("ROLLBACK");
                    return res.status(500).json({
                        error: "找不到指定的插入锚点"
                    });
                }
                const targetOrder = row.sort_order;

                // 注意这里的 >= ：目标自己以及它之后的元素全部后移，腾出目标原本的位置
                db.run("UPDATE user_costumes SET sort_order = sort_order + 1 WHERE user_id = ? AND sort_order >= ?", [user_id, targetOrder], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({
                            error: err.message
                        });
                    }

                    db.run(
                        "INSERT INTO user_costumes (user_id, name, origin, cover_url, model_id, components_data, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [user_id, name, origin, cover_url, model_id, components_data, targetOrder],
                        function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({
                                    error: err.message
                                });
                            }
                            db.run("COMMIT");
                            res.json({
                                success: true,
                                id: this.lastID
                            });
                        }
                    );
                });
            });

        } else {
            // 🌟 场景 3：常规新增，直接追加到末尾 (兜底逻辑)
            db.get("SELECT MAX(sort_order) as max_order FROM user_costumes WHERE user_id = ?", [user_id], (err, row) => {
                const nextOrder = (row && row.max_order !== null) ? row.max_order + 1 : 0;

                db.run(
                    "INSERT INTO user_costumes (user_id, name, origin, cover_url, model_id, components_data, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [user_id, name, origin, cover_url, model_id, components_data, nextOrder],
                    function(err) {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({
                                error: err.message
                            });
                        }
                        db.run("COMMIT");
                        res.json({
                            success: true,
                            id: this.lastID
                        });
                    }
                );
            });
        }
    });
});

// 重铸(修改)套装
app.put('/api/costumes/:id', (req, res) => {
    const {
        name,
        origin,
        cover_url,
        model_id,
        components_data
    } = req.body;
    if (!name) {
        return res.status(400).json({ error: '套装名称不能为空' });
    }
    db.run("UPDATE user_costumes SET name = ?, origin = ?, cover_url = ?, model_id = ?, components_data = ? WHERE id = ?",
        [name, origin, cover_url, model_id, components_data, req.params.id],
        function(err) {
            if (err) {
                console.error('更新套装失败:', err.message);
                return res.status(500).json({ error: '数据库更新失败' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: '套装不存在' });
            }
            res.json({ success: true });
        }
    );
});

// ====================
// 模特 API
// ====================
app.get('/api/models', (req, res) => {
    db.all("SELECT * FROM model_templates ORDER BY sort_order ASC, id DESC", [], (err, rows) => {
        if (err) {
            console.error("查询模特失败:", err.message);
            return res.status(500).json({
                error: err.message
            });
        }
        res.json(rows);
    });
});

app.get('/api/models/:id', (req, res) => {
    db.get("SELECT * FROM model_templates WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json(row);
    });
});

// ==================== 1. 新增模特接口 (支持精准插空) ====================
app.post('/api/models', (req, res) => {
    const {
        name,
        image_url,
        description,
        layout_data,
        insert_after_id,
        insert_before_id
    } = req.body;
    if (!name) return res.status(400).json({ error: '模特名称不能为空' });

    insertWithGapOrder(
        'model_templates',
        'name, image_url, description, layout_data',
        [name, image_url, description, layout_data],
        insert_after_id, insert_before_id,
        null,
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.id });
        }
    );
});

app.put('/api/models/:id', (req, res) => {
    const {
        name,
        image_url
    } = req.body;
    db.get("SELECT image_url FROM model_templates WHERE id = ? AND is_system = 0", [req.params.id], (err, row) => {
        try {
            if (row && typeof row.image_url === 'string' && row.image_url.startsWith('/assets/') && row.image_url !== image_url) {
                const relativePath = row.image_url.replace(/^\/assets\//, '');
                const oldFile = path.join(baseAssetDir, relativePath);
                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                    console.log(`🗑️ 销毁孤儿模型图: ${oldFile}`);
                }
            }
        } catch (e) {
            console.error(e);
        }
        db.run("UPDATE model_templates SET name = ?, image_url = ? WHERE id = ? AND is_system = 0", [name, image_url, req.params.id], function(err) {
            if (err) {
                console.error('更新模特失败:', err.message);
                return res.status(500).json({ error: '数据库更新失败' });
            }
            res.json({ success: true });
        });
    });
});

app.put('/api/models/:id/layout', (req, res) => {
    if (!req.body.layout_data) {
        return res.status(400).json({ error: '缺少 layout_data' });
    }
    db.run("UPDATE model_templates SET layout_data = ? WHERE id = ?",
        [req.body.layout_data, req.params.id],
        function(err) {
            if (err) {
                console.error('更新模特蓝图失败:', err.message);
                return res.status(500).json({ error: '数据库更新失败' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: '模特不存在' });
            }
            res.json({ success: true });
        }
    );
});

// ====================
// 组件字典 API
// ====================
// 检查 GET 组件列表接口
app.get('/api/components', (req, res) => {
    db.all("SELECT * FROM component_templates ORDER BY sort_order ASC, id DESC", [], (err, rows) => {
        if (err) {
            console.error("查询组件失败:", err.message);
            return res.status(500).json({
                error: err.message
            });
        }
        res.json(rows);
    });
});

// ==================== 2. 新增组件接口 (支持精准插空) ====================
app.post('/api/components', (req, res) => {
    const { name, type, icon_url, description, insert_after_id, insert_before_id } = req.body;
    if (!name) return res.status(400).json({ error: '组件名称不能为空' });
    if (!type) return res.status(400).json({ error: '组件类型不能为空' });

    insertWithGapOrder(
        'component_templates',
        'name, type, icon_url, description',
        [name, type, icon_url, description],
        insert_after_id, insert_before_id,
        null,
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.id });
        }
    );
});

app.put('/api/components/:id', (req, res) => {
    const {
        name,
        type,
        icon_url
    } = req.body;
    db.get("SELECT icon_url FROM component_templates WHERE id = ? AND is_system = 0", [req.params.id], (err, row) => {
        try {
            if (row && typeof row.icon_url === 'string' && row.icon_url.startsWith('/assets/') && row.icon_url !== icon_url) {
                const relativePath = row.icon_url.replace(/^\/assets\//, '');
                const oldFile = path.join(baseAssetDir, relativePath);
                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                    console.log(`🗑️ 销毁孤儿组件图: ${oldFile}`);
                }
            }
        } catch (e) {
            console.error(e);
        }
        db.run("UPDATE component_templates SET name = ?, type = ?, icon_url = ? WHERE id = ? AND is_system = 0", [name, type, icon_url, req.params.id], function(err) {
            if (err) {
                console.error('更新组件失败:', err.message);
                return res.status(500).json({ error: '数据库更新失败' });
            }
            res.json({ success: true });
        });
    });
});

// ====================
// 通用组件 API
// ====================
// 检查 GET 组件列表接口
app.get('/api/common-components', (req, res) => {
    db.all("SELECT * FROM common_components ORDER BY sort_order ASC, id DESC", [], (err, rows) => {
        if (err) {
            console.error("查询组件失败:", err.message);
            return res.status(500).json({
                error: err.message
            });
        }
        res.json(rows);
    });
});

// ==================== 2. 新增组件接口 (支持精准插空) ====================
app.post('/api/common-components', (req, res) => {
    const { name, type, icon_url, description, insert_after_id, insert_before_id } = req.body;
    if (!name) return res.status(400).json({ error: '组件名称不能为空' });
    if (!type) return res.status(400).json({ error: '组件类型不能为空' });

    insertWithGapOrder(
        'common_components',
        'name, type, icon_url, description',
        [name, type, icon_url, description],
        insert_after_id, insert_before_id,
        null,
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.id });
        }
    );
});

app.put('/api/common-components/:id', (req, res) => {
    const {
        name,
        type,
        icon_url
    } = req.body;
    db.get("SELECT icon_url FROM common_components WHERE id = ? AND is_system = 0", [req.params.id], (err, row) => {
        try {
            if (row && typeof row.icon_url === 'string' && row.icon_url.startsWith('/assets/') && row.icon_url !== icon_url) {
                const relativePath = row.icon_url.replace(/^\/assets\//, '');
                const oldFile = path.join(baseAssetDir, relativePath);
                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                    console.log(`🗑️ 销毁孤儿组件图: ${oldFile}`);
                }
            }
        } catch (e) {
            console.error(e);
        }
        db.run("UPDATE common_components SET name = ?, type = ?, icon_url = ? WHERE id = ? AND is_system = 0", [name, type, icon_url, req.params.id], function(err) {
            if (err) {
                console.error('更新通用组件失败:', err.message);
                return res.status(500).json({ error: '数据库更新失败' });
            }
            res.json({ success: true });
        });
    });
});


// ====================
// 核心：带有子目录智能清理的通用 DELETE 接口
// ====================
app.delete('/api/:type/:id', (req, res) => {
    let table = 'model_templates';
    let fileField = 'image_url';
    if (req.params.type === 'components') {
        table = 'component_templates';
        fileField = 'icon_url';
    } else if (req.params.type === 'common-components') {
        table = 'common_components';
        fileField = 'icon_url';
    }

    db.get(`SELECT ${fileField} FROM ${table} WHERE id = ? AND is_system = 0`, [req.params.id], (err, row) => {
        if (!row) return res.status(403).json({
            error: '无法删除或数据不存在'
        });
        try {
            const fileUrl = row[fileField];
            if (typeof fileUrl === 'string' && fileUrl.startsWith('/assets/')) {
                const relativePath = fileUrl.replace(/^\/assets\//, '');
                const filePath = path.join(baseAssetDir, relativePath);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🔥 物理文件已灰飞烟灭: ${filePath}`);
                }
            }
        } catch (e) {
            console.error(e);
        }
        db.run(`DELETE FROM ${table} WHERE id = ?`, [req.params.id], function(err) {
            if (err) {
                console.error('删除失败:', err.message);
                return res.status(500).json({ error: '数据库删除失败' });
            }

            // ===== 级联清理：删除公共模板后，同步清理所有引用了它的数据 =====
            const deletedId = Number(req.params.id);

            if (req.params.type === 'models') {
                // 清理所有使用了该模特的套装中的 model_id
                db.run(`UPDATE user_costumes SET model_id = NULL WHERE model_id = ?`, [deletedId]);
            } else if (req.params.type === 'components') {
                // 清理所有模特蓝图中的该组件节点
                db.all(`SELECT id, layout_data FROM model_templates`, [], (err, models) => {
                    models.forEach(model => {
                        if (!model.layout_data) return;
                        try {
                            const graph = JSON.parse(model.layout_data);
                            let changed = false;
                            graph.nodes = (graph.nodes || []).filter(n => {
                                if (n.data && n.data.componentId === deletedId) {
                                    changed = true;
                                    return false;
                                }
                                return true;
                            });
                            if (changed) {
                                graph.edges = (graph.edges || []).filter(e => {
                                    return graph.nodes.some(n => n.id === e.source) && graph.nodes.some(n => n.id === e.target);
                                });
                                db.run(`UPDATE model_templates SET layout_data = ? WHERE id = ?`, [JSON.stringify(graph), model.id]);
                            }
                        } catch (e) { /* 忽略解析错误 */ }
                    });
                });

                // 清理所有套装 components_data 中包含该组件的条目
                db.all(`SELECT id, components_data FROM user_costumes`, [], (err, costumes) => {
                    costumes.forEach(costume => {
                        if (!costume.components_data) return;
                        try {
                            const comps = JSON.parse(costume.components_data);
                            const filtered = comps.filter(c => c.compId !== deletedId);
                            if (filtered.length !== comps.length) {
                                db.run(`UPDATE user_costumes SET components_data = ? WHERE id = ?`, [JSON.stringify(filtered), costume.id]);
                            }
                        } catch (e) { /* 忽略解析错误 */ }
                    });
                });
            } else if (req.params.type === 'common-components') {
                // 清理所有套装中引用了该通用组件的 common_component_id
                db.all(`SELECT id, components_data FROM user_costumes`, [], (err, costumes) => {
                    costumes.forEach(costume => {
                        if (!costume.components_data) return;
                        try {
                            const comps = JSON.parse(costume.components_data);
                            let changed = false;
                            comps.forEach(c => {
                                if (c.common_component_id === deletedId) {
                                    c.common_component_id = null;
                                    c.icon = c.defaultIcon || '❓';
                                    c.realPreview = '';
                                    c.label = c.defaultLabel || c.label;
                                    c.searchQuery = '';
                                    c.isOwned = false;
                                    changed = true;
                                }
                            });
                            if (changed) {
                                db.run(`UPDATE user_costumes SET components_data = ? WHERE id = ?`, [JSON.stringify(comps), costume.id]);
                            }
                        } catch (e) { /* 忽略解析错误 */ }
                    });
                });
            }

            res.json({ success: true });
        });
    });
});

// ====================
// 查询作品 API
// ====================
// 获取所有作品来源
app.get('/api/origins', (req, res) => {
    const sql = 'SELECT * FROM origins ORDER BY name ASC';
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('查询作品源失败:', err.message);
            return res.status(500).json({
                error: '无法获取作品列表'
            });
        }
        res.json(rows);
    });
});

// 新增作品来源
app.post('/api/origins', (req, res) => {
    const {
        name
    } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({
            error: '作品名不能为空'
        });
    }

    const sql = 'INSERT INTO origins (name) VALUES (?)';

    db.run(sql, [name.trim()], function(err) {
        if (err) {
            // 如果报错是因为 UNIQUE 约束（即已存在同名作品）
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({
                    error: '该作品已存在'
                });
            }
            console.error('新增作品失败:', err.message);
            return res.status(500).json({
                error: '数据库写入失败'
            });
        }

        // 返回新增后的对象
        res.status(201).json({
            id: this.lastID,
            name: name.trim()
        });
    });
});

// ====================
// 最后访问套装 API
// ====================
// 1. 获取用户信息（包括最后访问的套装 ID）
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const sql = 'SELECT * FROM users WHERE id = ?';
  
  db.get(sql, [userId], (err, row) => {
    if (err) {
      console.error('获取用户信息失败:', err.message);
      return res.status(500).json({ error: '数据库查询失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(row);
  });
});

// 2. 更新用户最后访问的套装 ID
app.put('/api/users/:id/last-visited', (req, res) => {
  const userId = req.params.id;
  const { costumeId } = req.body;

  if (!costumeId) {
    return res.status(400).json({ error: '套装 ID 不能为空' });
  }

  const sql = 'UPDATE users SET last_visited_costume_id = ? WHERE id = ?';
  
  db.run(sql, [costumeId, userId], function(err) {
    if (err) {
      console.error('更新足迹失败:', err.message);
      return res.status(500).json({ error: '数据库更新失败' });
    }
    res.json({ success: true, message: '足迹已更新' });
  });
});

// Multer 错误处理中间件（文件过大、类型不合法等）
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: '文件过大，最大只允许 10MB' });
        }
        return res.status(400).json({ error: `上传异常：${err.message}` });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

app.listen(3000, () => console.log(`后端服务已启动`));