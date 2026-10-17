# VPS 转售剩余价值计算器

面向 VPS 转售者的纯前端报价工具。输入续费、日期、折损率、剩余价值和 Push 手续费，生成理论剩余价值、折损后建议价与可分享报价。

## 本地开发

```bash
npm install
npm run dev
```

运行测试和生产构建：

```bash
npm test
npm run build
```

## Cloudflare Pages 一键部署

完整部署说明见：[Cloudflare Pages 部署文档](docs/DEPLOY-CLOUDFLARE-PAGES.md)。

先完成 Wrangler 登录：

```bash
npx wrangler login
```

然后设置项目名并部署：

```bash
export CLOUDFLARE_PAGES_PROJECT=my-vps-calculator
npm run deploy:pages
```

也可以直接传入项目名：

```bash
npm run deploy:pages -- --project my-vps-calculator
```

脚本会先运行 `npm run build`，确认 `dist/index.html` 存在后，通过 Wrangler Direct Upload 发布。脚本不会读取或写入 API token。

## Cloudflare Worker 静态资源

`wrangler.jsonc` 已将 `dist/` 配置为静态资源目录并启用 SPA fallback。构建后可运行：

```bash
npx wrangler deploy
```

## 汇率与隐私

汇率来自 Frankfurter 公共 API。页面会缓存短时间内的成功响应，并在请求失败时阻止计算。分享数据编码在 URL fragment 中，不写入本工具的服务器；分享链接仍可能被聊天软件或截图保存，请勿填写个人敏感信息。
