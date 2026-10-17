# Cloudflare Pages 部署文档

本文档适用于 VPS 剩余价值计算器。项目是 Vite + TypeScript 纯前端应用，生产构建产物位于 `dist/`，不需要数据库、服务器或环境密钥。

## 一、准备工作

需要准备：

- 一个 Cloudflare 账户
- Node.js 18 或更高版本
- npm
- Cloudflare Pages 项目名

在项目目录执行：

```bash
npm install
npm test
npm run build
```

构建成功后应存在 `dist/index.html`。

## 二、命令行一键部署（推荐）

### 1. 登录 Wrangler

```bash
npx wrangler login
```

命令会打开浏览器完成 Cloudflare 授权。授权完成后，终端会显示登录成功。

### 2. 设置项目名

macOS/Linux：

```bash
export CLOUDFLARE_PAGES_PROJECT=vps-value-calculator
```

Windows PowerShell：

```powershell
$env:CLOUDFLARE_PAGES_PROJECT = "vps-value-calculator"
```

项目名只能使用字母、数字和连字符，且需要在 Cloudflare 账户内唯一。

### 3. 部署

```bash
npm run deploy:pages
```

脚本会依次执行：

1. `npm run build`
2. 检查 `dist/index.html`
3. 使用 Wrangler Pages Direct Upload 上传 `dist/`

也可以不设置环境变量，直接传项目名：

```bash
npm run deploy:pages -- --project vps-value-calculator
```

指定预览分支：

```bash
npm run deploy:pages -- --project vps-value-calculator --branch preview
```

如果账户下有多个 Cloudflare 账户，可额外设置：

```bash
export CLOUDFLARE_ACCOUNT_ID=你的账户ID
npm run deploy:pages
```

部署完成后，Wrangler 会输出 `https://<项目名>.pages.dev` 地址。

查看脚本参数：

```bash
npm run deploy:pages -- --help
```

## 三、通过 Cloudflare 控制台连接 Git

适合希望每次推送代码后自动部署的场景：

1. 打开 Cloudflare Dashboard，进入 **Workers & Pages**。
2. 点击 **Create application**，选择 **Pages**。
3. 选择 **Connect to Git**，授权 GitHub 或 GitLab 并选择仓库。
4. 构建配置填写：

   | 配置项 | 值 |
   | --- | --- |
   | Framework preset | `Vite`，如果没有则选择 `None` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | 仓库根目录 |
   | Node.js version | `18` 或更高版本 |

5. 点击 **Save and Deploy**。

本项目不需要配置环境变量。汇率请求在用户浏览器中执行，Cloudflare Pages 只负责托管静态文件。

## 四、GitHub Actions 自动部署

仓库内置了 `.github/workflows/deploy-pages.yml`：`main` 分支每次推送时自动运行测试、构建并部署到 Pages，也可以在 Actions 页面用 **Run workflow** 手动触发。

首次使用前配置仓库 Secrets（**Settings → Secrets and variables → Actions**）：

| 名称 | 说明 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 具有账户级 **Cloudflare Pages: Edit** 权限的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID，可在 Workers & Pages 概览页右侧栏找到 |

可选：在 **Variables** 中配置 `CLOUDFLARE_PAGES_PROJECT` 覆盖默认项目名 `vps-value-calculator`。

> **生产分支必须与 workflow 一致。** Cloudflare 判定生产部署的唯一依据是「部署分支 == 项目的 `production_branch`」，不一致时会被静默归为 Preview：Action 成功，线上却一直停在旧版本。本项目要求把 Pages 项目的生产分支设为 `main`（Direct Upload 项目需通过 API 的 `PATCH /accounts/{account_id}/pages/projects/{project}` 修改 `production_branch`，控制台对这类项目不显示该字段）；若用 Variables 换了项目名，新项目同样要设为 `main`。workflow 在部署后会校验新部署是否真的成为生产版本，不一致直接失败。另外 `workflow_dispatch` 从任何分支触发都会按生产发布，不要拿它试跑未完成的改动。

创建 Token 的路径：Dashboard → **My Profile → API Tokens → Create Token**，选择 **Edit Cloudflare Workers** 模板，或自定义权限并授予账户级 **Cloudflare Pages: Edit**。Token 只写入 GitHub Secrets，不要提交到仓库。

## 五、绑定自定义域名

部署后进入 Pages 项目：

1. 打开 **Custom domains**。
2. 点击 **Set up a custom domain**。
3. 输入域名并按提示完成 DNS 配置。

使用 Cloudflare 托管 DNS 时通常可以自动添加记录；使用其他 DNS 服务商时，需要按页面提示添加 CNAME 记录。

## 六、后续更新与回滚

### 手动更新

修改代码后再次执行：

```bash
npm run deploy:pages
```

### 自动更新

合并到 `main` 后，GitHub Actions 会自动完成测试、构建与部署，无需本地操作。

### 控制台回滚

进入 Pages 项目的 **Deployments**，找到目标部署，打开操作菜单并选择 **Rollback**。回滚只切换线上版本，不会删除本地代码。

## 七、常见问题

### 缺少项目名

看到 `缺少 Pages 项目名` 时，设置 `CLOUDFLARE_PAGES_PROJECT`，或使用 `--project` 参数。

### Wrangler 未登录

重新执行：

```bash
npx wrangler login
```

如果使用 CI，建议在 CI 的密钥管理中配置 Cloudflare 官方要求的认证变量，不要把 Token 写入仓库或脚本。

### 页面打开但分享链接刷新失败

本项目使用 URL fragment 保存分享数据，正常的 Pages 根路径即可处理分享链接。不要删除 `index.html`，也不要把输出目录改成 `src`。

### 汇率获取失败

部署本身成功并不代表汇率接口可用。页面会在浏览器中请求 Frankfurter；若网络、CORS 或公共接口限流导致请求失败，页面会阻止报价计算。检查浏览器网络访问和 Frankfurter 服务状态后重试。

## 八、安全提示

- 不要把 `CLOUDFLARE_API_TOKEN`、账户密钥或其他凭据提交到 Git。
- 分享链接中的报价和 VPS 配置编码在 URL fragment 中，拿到链接的人可以读取这些内容。
- 本工具没有后端存储，Cloudflare Pages 不会替你保存报价历史。
