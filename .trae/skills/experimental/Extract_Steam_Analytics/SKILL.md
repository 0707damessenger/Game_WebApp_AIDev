---
name: Extract_Steam_Analytics
description: 从 SteamSpy API 和 Gamalytic API 提取 Steam 市场分析数据（销量估算、评分、玩家数、标签、价格等），用于游戏参考选型与市场竞品研究。与 Find_Reference（Type A 来源提供者）和 Extract_Web_Reference（社区内容补充）协同工作。
---

# Extract_Steam_Analytics 技能说明

> **设计原则**：本技能专注于「结构化市场数据」，与 `Extract_Web_Reference`（非结构化社区内容）互补，共同为 `Find_Reference` 的 Type A 游戏参考选型提供量化支撑。

---

## 何时使用

| 场景 | 触发条件 |
|------|---------|
| **参考游戏验证** | 评估某款游戏是否满足 `Find_Reference` 的「强参考三项指标」（评论数/好评率/发布年份） |
| **市场竞品扫描** | 按类型标签筛选同类游戏，分析销量分布与定价区间 |
| **品类热度研究** | 查询某 Steam 标签下的热门游戏排行（TOP 100） |
| **游戏设计参数参考** | 查询目标参考游戏的玩家时长、CCU、好评率等可量化指标 |

**与相关技能的分工**：

| 数据需求 | 使用技能 |
|---------|---------|
| 评论数、好评率、销量、标签（结构化数字）| **本技能（Extract_Steam_Analytics）** |
| 社区讨论、玩家攻略、策略分析（文字内容）| `Extract_Web_Reference` |
| 综合评估游戏参考的可信度 | `Find_Reference` Type A |
| 提取游戏规则书（PDF）| `Extract_Rulebook` |

---

## 数据来源对比

| 维度 | SteamSpy API | Gamalytic API |
|------|------------|--------------|
| **费用** | 完全免费 | 有免费层；深度数据需注册，**当前暂不启用** |
| **API Key** | ❌ 不需要 | ✅ 需注册（暂不使用）|
| **覆盖游戏数** | ~100,000+ | ~50,000+ |
| **估算准确度** | ⚠️ 低销量游戏较准（±10%）；高销量严重高估 | 🟡 较好（77% 误差 ±30% 内，98% 误差 ±50% 内）|
| **F2P 游戏** | ⚠️ 不准 | ⚠️ 也不准 |
| **多算法融合** | 单一算法 | ✅ 书评倍数法 + CCU + 畅销排名 + 档案轮询 |
| **价格历史** | ❌ 无 | ✅ 含价格历史与折扣记录 |
| **速率限制** | 1次/秒（`all` 端点 1次/60秒）| 见 API 文档 |
| **Python 支持** | `steamspypi` PyPI 库 | 直接 HTTP 调用 |
| **适用场景** | 快速扫描、免注册初步筛选 | 深度市场分析、竞品精度要求高 |

**推荐策略**：先用 SteamSpy 做宽泛筛选（免费无障碍），对重点候选游戏再用 Gamalytic 验证。

---

## 操作步骤

### A. SteamSpy 查询流程（无需 API Key）

**Step A1：确定查询目标**

选择以下场景之一：

| 查询目标 | 端点 | 必要参数 |
|---------|------|---------|
| 单款游戏详情 | `appdetails` | `appid`（Steam 应用 ID） |
| 按标签筛选（如「roguelike」）| `tag` | `tag` 参数值 |
| 按流派筛选（如「Indie」）| `genre` | `genre` 参数值 |
| 近期热门 TOP 100 | `top100in2weeks` | 无 |
| 历史热门 TOP 100 | `top100forever` | 无 |
| 全量游戏列表 | `all` | `page`（分页，0 起始）|

**Step A2：构造请求 URL**

```
基础 URL：https://steamspy.com/api.php?request=[端点名]

示例：
# 单款游戏（appid 需从 Steam 商店页 URL 取得）
https://steamspy.com/api.php?request=appdetails&appid=413150

# 按 roguelite 标签查询
https://steamspy.com/api.php?request=tag&tag=Roguelite

# TOP 100（近两周）
https://steamspy.com/api.php?request=top100in2weeks
```

**Step A3：解读关键返回字段**

| 字段 | 含义 | 分析用途 |
|------|------|---------|
| `owners` | 拥有者数量（范围，如 "100,000 .. 200,000"）| 销量规模粗估 |
| `average_forever` | 历史平均游玩分钟数 | 留存度参考 |
| `average_2weeks` | 近两周平均游玩分钟数 | 近期活跃度 |
| `median_forever` | 历史中位游玩分钟数（比均值更准）| 典型用户行为 |
| `ccu` | 昨日峰值并发人数 | 当下热度 |
| `price` | 当前价格（美元分，除以100得美元）| 定价参考 |
| `initialprice` | 原价（用于判断折扣历史）| 定价策略 |
| `score_rank` | 评分排名（空值=数据不足）| 玩家口碑 |
| `tags` | 玩家标签 + 投票数 dict | 受众标签画像 |

> ⚠️ `owners` 为估算范围值，高销量游戏（>100万）高估严重。indie 游戏（<5万）相对准确。

**Step A4：Python 调用示例**

```python
import requests

def get_game_data(appid: int) -> dict:
    url = f"https://steamspy.com/api.php?request=appdetails&appid={appid}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()

def search_by_tag(tag: str) -> dict:
    url = f"https://steamspy.com/api.php?request=tag&tag={tag}"
    resp = requests.get(url, timeout=10)
    return resp.json()
```

---

### B. Gamalytic 查询流程【暂不启用】

> **状态**：Gamalytic 为付费服务，当前项目暂不使用。以下内容保留供未来参考，**跳过此节直接使用 SteamSpy 即可**。

**Step B1：API Key 获取**

> 📍 **注册地址**：[https://gamalytic.com](https://gamalytic.com)
>
> 步骤：注册账号 → Dashboard → API 设置 → 生成 API Key
>
> ⚠️ 免费层有请求次数限制；高频使用或商业用途需付费计划。

**Step B2：查看完整 API 文档**

> 📍 **API 参考文档**：[https://api.gamalytic.com/reference/](https://api.gamalytic.com/reference/)
>
> 文档为 Swagger UI 格式，需在浏览器中直接访问，包含所有端点、参数和示例响应。

**Step B3：请求格式**

```python
import requests

API_KEY = "your_gamalytic_api_key"

headers = {"Authorization": f"Bearer {API_KEY}"}
# 或根据文档使用 x-api-key 头，以文档为准

# 示例（以常见格式为参考，实际端点以文档为准）
url = "https://api.gamalytic.com/games"
params = {"appid": 413150}
resp = requests.get(url, headers=headers, params=params)
data = resp.json()
```

**Step B4：Gamalytic 核心数据指标**

| 指标类型 | 说明 |
|---------|------|
| 销量估算（Revenue / Units）| 多算法融合（书评倍数 + CCU + 畅销排名 + 档案轮询）|
| 准确度参考 | 77% 误差 ±30%；98% 误差 ±50%；F2P 不准 |
| 价格历史 | 含各区域定价和历史折扣，排除打包/第三方销售 |
| 评论分布 | 评论数、好评率、历史趋势 |

---

## 与 Find_Reference 的集成

本技能是 `Find_Reference` **Type A（游戏设计参考）** 流程中的量化数据来源：

```
Find_Reference Type A 工作流：
  Step 1：搜索候选游戏
  Step 2：量化验证（调用本技能）
    └── 提取：评论数 / 好评率 / 发布年份
    └── 验证三项指标是否满足强参考阈值：
         - 评论数 ≥ 1000（越高越可信）
         - 好评率 ≥ 80%（Very Positive 以上）
         - 发布年份 2021+（近 5 年）
  Step 3：Source Review → source_quality_log.md
```

**执行建议**：API 数据获取属于执行型任务，应优先使用轻量、稳定的执行方式完成数据抓取与整理。

---

## 输出格式

使用本技能后，输出以下结构化表格供 `Find_Reference` 使用：

```markdown
## Steam 市场数据 — [游戏名称]（[查询日期]）

| 指标 | 值 | 数据来源 | 备注 |
|------|---|---------|------|
| 拥有者估算 | [X万 – Y万] | SteamSpy | ⚠️ 范围值，高销量高估 |
| 评分 | [好评/差评/评论数] | Steam 官方 | / |
| 近2周均玩时长 | [X 分钟] | SteamSpy | 近期活跃参考 |
| 历史中位玩时长 | [X 小时] | SteamSpy | 典型用户行为 |
| 当前定价 | $[X.XX] | SteamSpy | |
| 昨日 CCU | [X] | SteamSpy | |
| 主要玩家标签 | [tag1, tag2, tag3] | SteamSpy | |
| 销量估算（Gamalytic） | [范围] | Gamalytic | 仅有 API Key 时填写 |

**参考价值评估**（依据 Find_Reference 三项标准）：
- 评论数：[✅/⚠️/❌] [具体数值]
- 好评率：[✅/⚠️/❌] [具体百分比]
- 发布年份：[✅/⚠️/❌] [年份]
- **综合结论**：[强参考 / 弱参考 / 不推荐]
```

**主契约关系**：

- Steam 市场数据属于研究与分析子文档，不得替代 `docs/design.md`
- 若市场数据结论被用于正式设计判断、竞品取舍或参数参考，必须同步更新 `docs/design.md`
- 如同时产出市场分析子文档或原始数据文件，必须在 `docs/design.md` 中补充引用关系与结论摘要

---

## 禁止模式

| 错误行为 | 正确做法 |
|---------|---------|
| 直接引用 SteamSpy 销量数字作为「事实」 | 明确标注「估算值，高销量游戏存在严重高估」 |
| 用本技能替代 Extract_Web_Reference 的社区内容提取 | 两者定位不同：本技能取结构化数字，Extract_Web_Reference 取社区文字内容 |
| F2P 游戏销量用 SteamSpy/Gamalytic 估算作结论 | F2P 估算极不准，仅参考 CCU 和评论数 |
| 单独用一个 API 源下结论 | 优先多源交叉验证（SteamSpy + Gamalytic + Steam 官方评论页）|
| 不记录原始 API 响应 | 将原始 JSON 保存到 `docs/data_extracted/[游戏名]/raw_steam_api.json` |
| 使用 `all` 端点过于频繁 | `all` 端点速率限制为 1次/60秒，批量查询用轮询 + 延时 |

---

## 完成自检

- [ ] 已获取目标游戏的 Steam appid（从 Steam 商店页 URL 提取）
- [ ] SteamSpy 数据已提取（owners / score / playtime / tags）
- [ ] 若有 Gamalytic API Key，已补充销量估算
- [ ] 输出表格中已标注估算值的不确定性
- [ ] 已对照 Find_Reference 三项指标给出「强参考 / 弱参考」结论
- [ ] 原始 JSON 已保存到 `docs/data_extracted/` 目录（批量查询时）
- [ ] 若市场数据结论已进入正式设计判断，已同步回写 `docs/design.md` 并补充引用关系

---

## 理论来源

> 📎 [SteamSpy 官方 API 文档](https://steamspy.com/api.php) — 🟢 — 官方端点说明、速率限制、字段定义
> 📎 [Gamalytic API 参考文档](https://api.gamalytic.com/reference/) — 🟢 — 官方端点说明（需浏览器访问 Swagger UI）
> 📎 [Gamalytic 官方博客 — 如何准确估算 Steam 销量](https://gamalytic.com/blog/how-to-accurately-estimate-steam-sales) — 🟢 — 多算法融合方法论；77% 误差 ±30%；F2P 限制
> 📎 [Gamalytic vs 竞品对比 — SaaSHub](https://www.saashub.com/compare-gamalytic-vs-steam-insights) — 🟡 — 第三方工具对比；准确度与覆盖范围评估
> 📎 [SteamSpy 准确性讨论 — IconEra 社区](https://icon-era.com/threads/steamspy-is-incredibly-inaccurate-and-should-not-be-considered-reliable.11033/) — 🟡 — 用户实战反馈：高销量高估严重，indie 小游戏相对准确
> 📎 [Nik Davis — Steam 数据收集教程](https://nik-davis.github.io/posts/2019/steam-data-collection/) — 🟡 — Python 实战教程：SteamSpy API + 数据清理流程
> 📎 [SteamSpyPI — PyPI 官方库](https://pypi.org/project/steamspypi/) — 🟡 — Python 封装库；验证 API 可程序化调用
