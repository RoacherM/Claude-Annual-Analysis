<!--
 * @Author: ByronVon
 * @Date: 2025-01-02 15:10:22
 * @FilePath: /ClaudeAnnualAnalysis/README.md
 * @Description: 
-->

# Claude Annual Analysis

一个用于分析Claude聊天记录的工具，支持token使用分析、对话模式分析和主题聚类。

### 生成结果
![Clustering Result](/out/result.png)

## 功能特点

### 1. Token使用分析
- 按日期统计每日token消耗数据
- 生成token使用趋势图表
- 分析平均对话时长和对话回合数
- 识别最长持续对话及其内容

### 2. 使用场景分析
- 工作/学习/生活场景使用比例分析
- 每日对话时段分布分析
- 季节性使用特征分析（春夏秋冬）

### 3. 主题聚类分析
- 基于高级文本聚类算法
- 支持聚类结果可视化
- 识别主要知识领域分布
- 生成主题摘要报告

## 快速开始

### 后端配置

1. 环境配置
```bash
# 克隆项目
git clone https://github.com/RoacherM/Claude-Annual-Analysis.git

# 安装依赖
pip install -r requirements.txt

# 将Claude数据导出到data文件夹

从 https://claude.ai/settings/account 下载个人历史数据，保存到data文件夹
```

2. 配置环境变量
复制`.env.example`到`.env`并填写必要的配置：
```
openai_api_key="YOUR-API-KEY"
openai_api_base="YOUR-API-BASE"
openai_model_name="YOUR-API-MODEL-NAME"
```

3. 运行分析
```bash
python main.py # 生成的结果保存在out文件夹
```

### 前端配置

1. 安装Node.js依赖
```bash
cd dashboard
npm install
```

2. 运行开发服务器
```bash
npm run dev
```

## 项目结构

- `main.py`: 主程序入口
- `chat_analyzer.py`: 聊天数据分析核心模块
- `text_clustering.py`: 文本聚类分析模块
- `utils.py`: 通用工具函数
- `dashboard/`: 可视化面板目录

## 技术栈

### 后端
- Python 3.8+
- OpenAI API
- Sentence Transformers
- FAISS
- UMAP
- DBSCAN
- Plotly
- Pandas
- NumPy

### 前端 (Dashboard)
- Next.js 15.1.3
- React 19
- TypeScript 5
- Tailwind CSS 3.4
- Recharts 2.15
- Nivo Calendar 0.88
- Date-fns 4.1
- HTML2Canvas 1.4

## 依赖版本

### Python 依赖
```
python-dotenv==1.0.1
openai==1.54.3
pandas>=2.2.3
numpy==1.26.4
sentence-transformers>=2.2.0
faiss-cpu>=1.7.0
umap-learn>=0.5.0
scikit-learn>=1.5.2
plotly>=5.24.1
rich>=10.0.0
tqdm>=4.62.0
matplotlib>=3.4.0
```

### NPM 依赖
```json
{
  "dependencies": {
    "@nivo/calendar": "^0.88.0",
    "@types/papaparse": "^5.3.15",
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0",
    "html2canvas": "^1.4.1",
    "next": "15.1.3",
    "papaparse": "^5.4.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@shadcn/ui": "^0.0.4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.1.3",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
