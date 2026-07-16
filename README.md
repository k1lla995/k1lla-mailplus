<p align="center">
  <img src="doc/demo/logo.png" width="80" alt="Cloud Mail logo" />
</p>

<h1 align="center">Cloud Mail</h1>

<p align="center">
  一个基于 Cloudflare 的 Serverless 邮箱服务，支持多账号管理、邮件收发与附件存储。
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/frontend-Vue%203-42b883.svg" alt="Vue 3" />
  <img src="https://img.shields.io/badge/backend-Cloudflare%20Workers-f38020.svg" alt="Cloudflare Workers" />
</p>

## 项目简介

Cloud Mail 是一个轻量、响应式的邮箱管理系统。只需要一个域名，就可以创建和管理多个邮箱账号，并通过 Cloudflare 的边缘基础设施部署后端服务，降低传统服务器的运维成本。

这个项目适合作为 Serverless 全栈应用的实践案例，覆盖了前后端分离、权限控制、邮件处理、对象存储和数据可视化等常见工程场景。

## 功能特性

- **邮箱账号管理**：创建、管理多个邮箱账号和域名。
- **邮件收发**：支持邮件接收、发送、回复、转发和状态追踪。
- **附件处理**：支持附件上传、接收和下载，文件存储在 Cloudflare R2。
- **管理员控制台**：提供用户、邮件、系统配置和权限管理能力。
- **权限控制**：基于角色的访问控制（RBAC），限制不同用户的功能和资源访问范围。
- **邮件推送**：可将收到的邮件转发到 Telegram 或其他邮箱服务。
- **验证码识别**：结合 Workers AI 自动识别邮件中的验证码。
- **数据可视化**：使用 ECharts 展示用户和邮件等系统数据。
- **安全防护**：集成 Cloudflare Turnstile，降低批量注册和自动化攻击风险。
- **响应式界面**：适配桌面端及主流移动端浏览器。
- **国际化支持**：内置中文和英文界面。
- **开放 API**：支持批量创建用户和按条件查询邮件。

## 技术栈

### 前端

- Vue 3 + Vite
- Element Plus
- Pinia
- Vue Router
- Vue I18n
- ECharts

### 后端与基础设施

- Cloudflare Workers
- Hono
- Drizzle ORM
- Cloudflare D1：关系型数据存储
- Cloudflare KV：缓存和配置存储
- Cloudflare R2：附件和对象存储
- Resend：邮件发送服务
- Workers AI：验证码识别
- Cloudflare Turnstile：人机验证

## 项目结构

```text
cloud-mail/
├── mail-vue/                 # Vue 3 前端应用
│   └── src/
│       ├── components/       # 通用组件
│       ├── layout/            # 页面布局
│       ├── request/           # API 请求层
│       ├── router/            # 路由配置
│       ├── store/             # 全局状态
│       └── views/             # 页面组件
├── mail-worker/              # Cloudflare Workers 后端
│   ├── src/
│   │   ├── api/              # API 接口
│   │   ├── dao/              # 数据访问层
│   │   ├── email/             # 邮件处理
│   │   ├── security/          # 认证与授权
│   │   ├── service/           # 业务服务
│   │   └── index.js           # Worker 入口
│   └── wrangler.toml          # Workers 配置
├── doc/                      # 部署和使用文档
└── LICENSE
```

## 本地开发

### 环境要求

- Node.js 18 或更高版本
- pnpm
- Cloudflare 账号及 Wrangler CLI

### 启动前端

```bash
cd mail-vue
pnpm install
pnpm dev
```

### 启动后端

```bash
cd mail-worker
pnpm install
pnpm dev
```

具体的 Cloudflare D1、KV、R2、域名和邮件服务配置，请参考 [`doc`](doc) 目录下的部署文档，并根据自己的环境填写配置文件和密钥。不要将 API Token、数据库凭据或其他敏感信息提交到仓库。

## 构建与部署

构建前端：

```bash
cd mail-vue
pnpm build
```

部署 Worker：

```bash
cd mail-worker
pnpm deploy
```

首次部署后，访问原有初始化地址即可初始化数据库并创建管理员账号。管理员邮箱取自 `admin` 环境变量，不能再通过公开注册页面创建：

```bash
https://你的项目域名/api/init/你的jwt_secret
```

初始化响应会显示一次随机生成的管理员临时密码；请立即保存它、登录后在个人设置中修改密码。旧版本升级后也应执行一次该初始化地址，为现有账号写入可信管理员标记并重置其密码。请勿公开或长期保留该初始化地址，因为其中包含 `jwt_secret`。

如果使用自动化部署，首次部署不要配置自动初始化 URL；应手动打开上述地址以查看临时密码。

部署前请确认 Wrangler 配置中的 D1、KV、R2 绑定和环境变量已经完成设置。生产环境建议通过 GitHub Actions 或其他 CI 流程执行部署。

## 截图

| 邮箱列表 | 邮件详情 |
| :---: | :---: |
| ![邮箱列表](doc/demo/demo1.png) | ![邮件详情](doc/demo/demo2.png) |

| 管理后台 | 系统数据 |
| :---: | :---: |
| ![管理后台](doc/demo/demo3.png) | ![系统数据](doc/demo/demo4.png) |

## 开源协议

本项目使用 [MIT License](LICENSE) 开源。

