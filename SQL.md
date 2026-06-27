-- 1. 用户表 (固定两条数据)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL
);
INSERT INTO users (id, username) VALUES (1, 'Coser_A'), (2, 'Coser_B');

-- 2. 全局组件模板表 (两人共享，定义有哪些种类的配件)
CREATE TABLE component_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,       -- 如: '上衣', '武器', '假发'
    icon_url TEXT             -- 像素图标路径
);

-- 3. 全局模特模板表 (两人共享)
CREATE TABLE model_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,       -- 如: '女性-连衣裙模板', '男性-长袍模板'
    image_url TEXT            -- 模特底图路径
);

-- 4. 模特最大关系连线表 (两人共享，记录模特周围有哪些槽位及连线坐标)
CREATE TABLE model_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_template_id INTEGER,
    component_template_id INTEGER,
    position_x REAL,          -- 节点在画布上的 X 坐标
    position_y REAL,          -- 节点在画布上的 Y 坐标
    target_x REAL,            -- 连线指向模特身体部位的 X 坐标
    target_y REAL,            -- 连线指向模特身体部位的 Y 坐标
    FOREIGN KEY(model_template_id) REFERENCES model_templates(id),
    FOREIGN KEY(component_template_id) REFERENCES component_templates(id)
);

-- 5. 用户专属：COS服套装表 (数据隔离)
CREATE TABLE user_costumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    cover_url TEXT,           -- 封面缩略图
    model_template_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(model_template_id) REFERENCES model_templates(id)
);

-- 6. 用户专属：套装具体组件状态表 (数据隔离)
-- 这一步实现了：某套衣服只激活模特最大槽位里的某几件，并记录是否拥有
CREATE TABLE user_costume_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    costume_id INTEGER,
    component_template_id INTEGER,
    is_owned INTEGER DEFAULT 0,     -- 0为未拥有，1为已拥有
    is_universal INTEGER DEFAULT 0, -- 0为专属，1为通用
    custom_image_url TEXT,          -- 针对这套衣服该组件的实拍图
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(costume_id) REFERENCES user_costumes(id),
    FOREIGN KEY(component_template_id) REFERENCES component_templates(id)
);