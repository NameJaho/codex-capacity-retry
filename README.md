# codex-capacity-retry

一个 [Paseo](https://paseo.sh) 服务端插件：当 Codex 等 agent 因为

```
Selected model is at capacity. Please try a different model.
```

中断时，自动等待一会儿后发送 `继续`，不需要再手动盯着重试。

## 工作原理

插件监听 Paseo 的 `agent.turn_ended` 生命周期事件。每当一个 agent 的回合结束：

1. 读取回合结果。provider 的容量报错会以 `turn_failed` 出现，插件取其中的错误信息。
2. 同时检查该回合时间线末尾的 `error` / `notification` 条目。
3. 如果文本匹配 `at capacity` 或 `please try a different model`，等待 15 秒后向该 agent 发送 `继续`。

只检查错误信息，不检查 agent 的正文回复和思考内容。所以 agent 只是在对话里"讨论"这句报错时不会误触发，你自己发的消息里带这句话也不会。

### 重试次数

- 默认会持续自动重试，直到某一轮正常结束、回合被取消，或插件被停用。
- 如需限制次数，将 `index.server.ts` 顶部的 `MAX_RETRIES` 改为正整数；达到上限后停止并记录日志。设置为 `0` 表示不限制。
- 只要某一轮正常结束（没有命中报错），计数就清零。
- 回合被手动取消时也会清零，不会重试。

## 环境要求

- Paseo daemon `>= 0.13.2`
- daemon 已开启插件功能（见下文）
- 安装依赖和类型检查需要 Node.js 与 npm

## 安装

### 1. 开启插件功能

插件是受信任、不受沙箱限制的代码。服务端插件可以访问 daemon 所在机器的文件、进程、凭据和网络。请确认你信任这份代码后再开启。

在 Paseo 应用里打开 **Settings → Plugins → Enable plugins**，或编辑 daemon 的 `config.json`（本地默认是 `~/.paseo/config.json`），在根层级加上：

```json
{
  "pluginsEnabled": true
}
```

然后让配置生效：

```bash
paseo reload
```

### 2. 安装插件

从 GitHub 直接安装：

```bash
paseo plugin install github:<你的用户名>/codex-capacity-retry
```

或者克隆到本地后安装：

```bash
git clone https://github.com/<你的用户名>/codex-capacity-retry.git
cd codex-capacity-retry
npm install
npm run typecheck
paseo plugin install "$(pwd)"
```

### 3. 确认运行状态

```bash
paseo plugin ls codex-capacity-retry
```

`STATUS` 显示 `running` 即安装成功。

## 配置

可调参数是 `index.server.ts` 顶部的常量：

| 常量 | 默认值 | 说明 |
| --- | --- | --- |
| `CAPACITY_PATTERN` | `/at capacity\|please try a different model/i` | 判定为容量报错的正则 |
| `FOLLOW_UP` | `"继续"` | 自动发送的消息内容 |
| `RETRY_DELAY_MS` | `15000` | 检测到报错后等待多久再重试（毫秒） |
| `MAX_RETRIES` | `0` | 同一 agent 最多连续重试次数；`0` 表示不限次数 |
| `TIMELINE_TAIL` | `20` | 读取时间线末尾多少条记录 |

改完后重新加载：

```bash
npm run typecheck
paseo plugin reload codex-capacity-retry
```

想匹配其他报错（比如限流、额度不足），修改 `CAPACITY_PATTERN` 即可。

## 查看日志

```bash
paseo plugin logs codex-capacity-retry
```

触发重试时会输出：

```
Capacity error on <agentId>, retry 1/5 in 15000ms
```

设置了正整数上限并达到上限时会输出：

```
Giving up on <agentId> after 5 capacity retries
```

也可以在 Paseo 应用的 **Settings → Plugins → Logs** 查看。

## 管理

```bash
paseo plugin disable codex-capacity-retry   # 临时停用
paseo plugin enable codex-capacity-retry    # 重新启用
paseo plugin remove codex-capacity-retry    # 卸载
```

## 已知限制

- 重试是发送一条新消息，不会重放失败回合里的附件，也不会撤销已执行的工具操作。
- 重试计数保存在内存里，插件重载或 daemon 重启后会清零。
- 重试只发送 `继续`，不会切换模型。如果模型长时间满载且 `MAX_RETRIES` 为 `0`，插件会持续重试；设置正整数可以限制连续重试次数。

## 项目结构

```
codex-capacity-retry/
  paseo-plugin.json    插件清单（ID 与版本要求）
  index.server.ts      服务端入口：监听回合结束并触发重试
  server/inspect.ts    从时间线中提取错误文本
  OVERVIEW.md          Paseo 插件页面中展示的简介
```

## 致谢

思路参考了 Paseo 官方示例 [lifecycle-actions](https://github.com/getpaseo/paseo/tree/main/plugin-examples/lifecycle-actions) 和 [paseo-notifier](https://github.com/winezer0/paseo-notifier)。
