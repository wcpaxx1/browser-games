# 零号中继 · 石城爆破：游玩范围与已知限制

当前三视角版本为私人开发候选。新代码只有模型回归与原生 Canvas 渲染检查，尚未进行真实浏览器操作和新一轮玩家体验。下面提到的三轮体验及普通游玩验证仅属于改造前版本，不构成此版本通过。

请使用电脑键盘和鼠标。切换窗口前先按 Esc 或点击页面的双竖条暂停按钮。

- 自动失焦暂停历史实测未通过，当前版本未重新实测；不要依赖切换标签或窗口自动暂停。主动 Esc / 页面暂停及继续流程已在普通游玩中验证。
- 避免多标签同时游玩。清空存档前请关闭其他本游戏标签：已有跨标签清空后，旧标签可能写回旧回合的边界尚未修复。普通保存、重试与部分格式兼容检查不代表所有存档异常均已通过。
- 已有三轮独立普通玩家代理体验、反馈改进与定向复测；参与者是代理，不是真人受试者。主要验证了桌面光标兼容瞄准下的开始、移动、射击、安包、倒下观看、拆除结局、暂停和重试。没有验证持续真人手感、完整锁鼠输入、多设备或移动触屏体验。
- 实际对局中已看到暂停时的拆除进度卡、剩余秒数和 A 点方向距离；背向观察、连续百分比变化及全方向显示未完整实测。箭头指向已知拆除点 A，不代表显示所有敌人的位置。
- 清除守卫的胜利曾在早期试玩出现；当前胜利 HUD 分支主要有工程回归证据，倒计时归零的爆破胜利尚无完整普通玩家实测，不能视为全部结局均已验证。
- 最后一名守卫被击倒时，终局可能把姿态停在动作开始处。这项已有视觉瑕疵未修复；现有试玩未见它阻断结算或重试。本次第一人称前景已更换为原创写实图像；它不是全三维手部模型，仍须当前版本美术验收。

这些说明用于帮助选择游玩方式，不构成全状态、全设备、性能或安全性的保证。

三视角专项限制：V 键和设置提供第一人称、近距跟随、远距跟随。跟随镜头按角色碰撞地图收近，狭窄处两种距离可能接近；镜头贴身时角色淡出以免遮挡。视角偏好用独立版本键保存，旧进度格式不变。跟随视角准星显示原角色眼位权威射线的首次命中点，靠近遮挡物时可能偏离鼠标位置；离开画面的命中点以边缘黄色准星表示。现有场景使用深度遮挡与定向角色精灵，并非全多边形角色模型。


## 0.1.2 realistic foreground revision
- New original transparent carbine/glove/sleeve asset replaces the visible polygon foreground. This is a perspective viewmodel image, not a newly modeled 3D hand skeleton. Rear character remains the prior depth-clipped directional photographic sprite.
- The original core shoots from the player eye. That authoritative origin and target calculation are unchanged. A separate collision-swept cosmetic barrel anchor supplies the visual trace start and muzzle flash; both views use the existing exact shot endpoint. Cosmetic placement grants no additional hit or peek ability.
- The first-person viewmodel uses a bounded presentation rig at peripheral cursor positions so the weapon remains visible. Its on-screen flash and trace start stay attached to the visible barrel; the trace endpoint and authoritative eye ray are unchanged. The bounded image is no longer claimed to be an exact world-space barrel projection at extreme angles. Rear views retain the collision-swept world attachment. Reload and genuinely close cover may still lower the assembly; original timing, ammo and audio remain authoritative.
- Pause symbols use authored CSS bars. Current 0.1.2 needs its own browser geometry/art/input review and three sequential player-feedback cycles. Native captures and previous-version review are not acceptance.
