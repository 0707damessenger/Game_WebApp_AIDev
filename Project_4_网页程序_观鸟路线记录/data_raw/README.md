# 模糊匹配特征 · 原始数据下载说明

本文件夹存放从公开数据集下载的原始文件，供 `tools/build_traits.mjs` 生成 `prototype/js/bird_traits.js`。
这些原始文件**体积大、含第三方授权，不纳入 git**（已在 `.gitignore` 忽略，仅保留本说明）。

> 当前进度：**EltonTraits 已就位**（体型、行为可用）。下面 **AVONET（栖息地）** 与 **HBW（主色）** 需你手动下载。
> 下载后把文件按「目标文件名」放到本文件夹，运行 `node tools/build_traits.mjs` 即可重新生成特征表。

文件名必须**完全一致**（脚本按名查找）：

| 维度 | 目标文件名（放本文件夹） | 来源 |
|---|---|---|
| 体型 / 行为 | `BirdFuncDat.csv` ✅已就位 | EltonTraits 1.0 |
| 栖息地 | `AVONET.xlsx` | AVONET |
| 主色 | `hbw_color_legend.csv` + `hbw_color_proportion.csv` | HBW 色彩数据集 |

---

## 1. AVONET（栖息地）→ `AVONET.xlsx`

1. 打开 figshare 页面：<https://figshare.com/articles/dataset/16586228>
   （或备用入口 <https://figshare.com/s/b990722d72a26b5bfead>）
2. 在文件列表里找到 **`AVONET Supplementary dataset 1.xlsx`**，点它右侧的 **Download** 下载。
   - 这是个几十 MB 的 Excel 工作簿，里面有多个工作表，**不用你手动打开或转换**。
   - **只需要 dataset 1**；`Supplementary dataset 2`（部分个体的重复测量，用于测量误差分析）与本项目无关，不用下载。脚本只读其中 `AVONET1_BirdLife` 表的 `Species1`(B列) 与 `Habitat`(AA列)。
3. 把下载到的文件**改名为 `AVONET.xlsx`**，放进本文件夹（`data_raw/`）。
   - 脚本会自动选用其中的 `AVONET1_BirdLife` 工作表，读取 `Species1`（学名）和 `Habitat`（栖息地）两列。

## 2. HBW 色彩数据集（主色）→ 两个 csv

1. 打开 Dryad 页面：<https://datadryad.org/dataset/doi:10.5061/dryad.70rxwdc6s>
2. 点 **Download dataset**，得到 `Data_S1.zip`（约 79 MB）。
3. 解压 `Data_S1.zip`，里面会有：
   - `RGB_values_for_color_classification.csv`（很小，约 1 KB，是 24 种颜色的名称对照表）
   - `Information_for_Illustrations_and_proportion_of_24_colors.csv`（约 5 MB，是每个物种 24 色占比）
   - （还有一个 80MB 的 `RGB_values.zip` 逐像素数据，**不需要**，忽略它）
4. 把这两个文件**改名后**放进本文件夹（命名对应关系已核对无误）：
   - `RGB_values_for_color_classification.csv`（含 `Color classification` / `Colors` 列，是 24 色→颜色名图例）→ 改名 **`hbw_color_legend.csv`**
   - `Information_for_Illustrations_and_proportion_of_24_colors.csv`（含 `Sci_name` 与 `color1`–`color24` 占比列）→ 改名 **`hbw_color_proportion.csv`**

## 3. 生成特征表

文件齐了之后，在 **Project_4 项目根目录**（即本文件夹的上一级）打开终端，运行：

```
node tools/build_traits.mjs
```

成功后会打印各维度覆盖率，并更新 `prototype/js/bird_traits.js`。刷新网页原型即可生效。

---

## 备注

- 缺哪个文件，脚本会跳过对应维度并给出提示，不会报错中断；可以先只放 AVONET 或只放 HBW 分步验证。
- 学名分类版本与名录 v10.0 可能略有出入，未命中的物种对应维度留空，由常见种精校（`tools/trait_overrides.json`）补足。
- 各数据集的授权与署名要求见 `docs/feature_source.md`；公开或产品化前需复核。
