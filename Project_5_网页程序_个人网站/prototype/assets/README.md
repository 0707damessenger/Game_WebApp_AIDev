# 图片资源目录

网页原型中的图片都放在当前目录下，并在 `prototype/index.html` 顶部的 `window.CONFIG` 中填写对应路径。所有图片字段都是可选的：留空时页面会继续使用几何占位，填写后会显示本地 PNG 图片。

## 目录结构

```text
assets/
├── avatar/                         # 头像类
├── navigation/                     # 顶部页签图案
├── projects/                       # 项目详细图片
├── links/
```

## 建议命名

文件名使用英文小写、数字和短横线，例如 `profile.png`、`project-01.png`、`friend-01.png`。同一条内容的图片和配置项使用相同编号，后续替换图片时不需要改页面结构。

## 配置位置

- 首页头像：`CONFIG.pages.home.avatarSrc`
- 顶部页签：`CONFIG.nav` 对应项目的 `iconSrc`
- 精选项目图片：`CONFIG.pages.projects.featured` 对应项目的 `imageSrc`
- 项目详细图片：`CONFIG.pages.projects.sections` 对应项目的 `imageSrc`
- 链接图片：`CONFIG.pages.links.groups` 对应链接的 `imageSrc`

路径以 `prototype/index.html` 所在目录为起点，例如：`assets/avatar/profile.png`。
