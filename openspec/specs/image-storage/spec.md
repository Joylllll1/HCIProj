# 图片独立文件存储与轻量内容接口

## 用户范围

用户指明要处理 README「已知限制」中图片以内联 base64 存 MongoDB、列表接口体积过大的问题。草稿列表摘要只是局部修复；本轮完成独立后端本地文件存储和同源图片地址，保持上传、压缩、多图、GIF、长图、编辑、发布及 SSE 的现有交互。课程项目采用本地持久目录，不接入需要新账号的云服务，不扩展限流/配额/自动清理框架。

## 验收

1. 新帖子、草稿、评论、回复及活动海报的图片写入后端文件目录；MongoDB 保存内部文件引用。
2. 内容 JSON 和 SSE 中返回同源 `/api/media/...` 地址，不返回图片 base64 或内部文件路径。草稿列表仍只返回摘要。
3. 图片 GET 独立传输二进制，具有 ETag 与浏览器私有缓存；内容更新产生新的图片版本地址。
4. 媒体读取沿用资源权限：帖子/评论须有效；草稿仅作者可读；待审活动仅申请者/管理员可读，公开活动可读。用户不能提交任意磁盘路径或引用别人的私有草稿图片。
5. 旧 MongoDB base64 图片继续能显示和编辑；图片 GET 按需解码旧数据，列表不携带原图。提供可选迁移命令将旧数据转为文件引用，不直接操作用户真实数据库。
6. 保存/再次编辑草稿、移除/重新排列图片及发布草稿保留图片；服务端验证最多9张、单张3MiB、合计8MiB的既有编码大小限制。返回草稿图片编码大小 `imageBytes`，便于客户端合并新图片时检查总量。
7. 文件名仅由服务端生成；上传图片以正确 Content-Type、nosniff 和隔离 SVG 的 CSP 返回，不能作为同源可执行页面。
8. 配置目录须与 MongoDB 一并持久化/备份；文档明确本地存储及剩余的配额/资源清理待办。
9. 两端 lint/test、前端 build、权限独立复查通过；真实 HTTP 测试覆盖二进制/缓存/权限，浏览器验证图片发布和草稿编辑。

## 实现协作契约

- `backend/src/services/imageStorage.js`：`storeInlineImage(value, label)`、`storeInlineImages(values, options)` 仅接收经现有内联校验的新图片；`storeTrustedImages(values, options)` 接收服务端已确认属于当前内容的内部引用或旧 base64，统一验证编码体积并转存；`isStoredImageRef(value)`；`getImageEncodedBytes(value)`；`readImage(value)` 返回 `{ buffer, contentType, etag }`。目录动态读取 `IMAGE_STORAGE_DIR`，默认 `backend/storage/images/`。
- 内部引用为 `file:<sha256>.<ext>`，不能作为客户端新图片直接传入。
- `backend/src/utils/media.js`：`mediaUrl(kind, id, key, image)` 为图片生成含版本的资源地址；`serializePostMedia(post)`、`serializeDraftMedia(draft)`、`serializeCommentMedia(comment)`、`serializeEventMedia(event)` 保留非图片字段，将所有 `image/images` 转成资源地址。
- 路径：`/api/media/posts/:id/:index`、`/api/media/drafts/:id/:index`、`/api/media/comments/:id`、`/api/media/replies/:commentId/:replyId`、`/api/media/events/:id`，追加 `?v=<content-version>`。新路由通过 controller/service/model 分层读取资源、检查权限后交给 imageStorage。
- 草稿更新可提交当前草稿详情的图片 URL，服务端仅将它们映射回该作者当前草稿中相应的图片；新增图片继续提交 base64，前端不新增上传步骤。
- DTO 对象均使用字符串 `id` 或 `_id`；序列化前使用原始数据库图片值，避免重复序列化地址。
- 图片文件不会随单个帖子/草稿删除而立即移除，防止误删其他内容复用的文件；自动清理单列为待办。

## 完成证据

2026-10-26：上述9项均已实现并验证，详细证据见 [图片存储](../../../docs/image-storage.md)。前端38文件 / 221测试、后端79测试、两端lint、前端build与diff检查通过。服务与媒体HTTP测试覆盖新写入、旧数据、所有者权限、缓存、原子写入及迁移；浏览器通过实际HTTP/临时文件验证桌面编辑发布和移动大图，数据库边界为内存模型替身，未执行用户真实数据迁移。
