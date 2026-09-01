# GLM5.2 provider 配置模板（OpenCode / OMP / PI）

本目录存放 GLM5.2 的 provider 配置模板与说明。网关以 `providerID/modelID` 的形式把模型名透传给底层引擎（wire name 为 `zai/glm-5.2`），因此每个引擎都需要一份指向 OpenAI 兼容端点的 provider 配置。默认端点为 Z.ai 官方地址 `https://api.z.ai/api/paas/v4`，可通过环境变量 `ZAI_BASE_URL` 覆盖；密钥通过环境变量 `ZAI_API_KEY` 注入。

## 1. OpenCode

把 `opencode.glm.json` 的内容并入 OpenCode 的全局配置文件 `~/.config/opencode/opencode.json`（Windows 为 `%USERPROFILE%\.config\opencode\opencode.json`），合并时保留该文件里已有的其他配置项。随后设置环境变量 `ZAI_API_KEY`（必填）与 `ZAI_BASE_URL`（可选，缺省即官方端点 `https://api.z.ai/api/paas/v4`）。

模板里两个占位符的展开方式：`{env:ZAI_API_KEY}` 是 OpenCode 自带的环境变量引用写法，由 OpenCode 运行时读取；`${ZAI_BASE_URL}` 则由网关启动时替换——若该模板文件被复制到 OpenCode 工作目录，网关 `main.js` 启动前会读取环境变量并渲染模板完成替换；若实测发现 OpenCode 自身支持对 `options.baseURL` 做环境展开，则无需网关替换。以 Task 17 演练时 `opencode models` 的实测结果为准修正模板与本说明。

## 2. OMP

在 OMP 的 provider 配置中新增一个 OpenAI 兼容 provider，参数与 OpenCode 模板等价：`baseURL` 取环境变量 `ZAI_BASE_URL` 的值（缺省为 `https://api.z.ai/api/paas/v4`），`apiKey` 取 `ZAI_API_KEY` 的值，模型 ID 使用 `glm-5.2`，provider 名称使用 `zai`，这样 wire name `zai/glm-5.2` 就会出现在 OMP 的可选模型列表里。provider 配置通常位于 `~/.config/omp/` 目录下（Windows 对应 `%USERPROFILE%\.config\omp\`），但具体文件名与配置键名随 OMP 版本可能不同：请先运行 `omp --help` 查看当前版本声明的配置文件位置与格式，再按上述参数写入对应字段。

## 3. PI

在 PI 的 models 配置中新增一个与上述同参数的 OpenAI 兼容 provider：`baseURL=$ZAI_BASE_URL`（缺省 `https://api.z.ai/api/paas/v4`）、`apiKey=$ZAI_API_KEY`、模型 ID `glm-5.2`、provider 名 `zai`。PI 的 models 配置位于用户目录 `~/.pi/` 或项目目录 `.pi/` 下；若你的 PI 版本配置位置或键名与此不同，请运行 `pi --help` 或查阅 PI 官方文档确认 models 配置的写入位置与字段名后，按上述参数填写。

## 4. 环境变量

三处配置均只依赖两个环境变量：`ZAI_API_KEY`（API 密钥，必填）与 `ZAI_BASE_URL`（OpenAI 兼容端点，可选，默认 `https://api.z.ai/api/paas/v4`），模板中不出现任何明文密钥。网关的默认模型通过环境变量 `GATEWAY_DEFAULT_MODEL=zai/glm-5.2` 设置；该值以 `providerID/modelID` 形式原样透传给所选引擎，因此各引擎配置中的 provider 名与模型 ID 必须分别是 `zai` 与 `glm-5.2`，才能与 wire name `zai/glm-5.2` 匹配。

## 5. 演练验证（Task 17）

Task 17 的实机演练会逐引擎验证模型目录中出现 `zai/glm-5.2`（例如对 OpenCode 运行 `opencode models` 检查）。若某个引擎的实际配置键名与本文模板有出入，会在演练步骤中修正模板并回填本 README，演练结论是这些模板的最终准绳。
