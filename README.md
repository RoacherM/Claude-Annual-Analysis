<!--
 * @Author: ByronVon
 * @Date: 2025-01-02 15:10:22
 * @FilePath: /ClaudeAnnualAnalysis/README.md
 * @Description: 
-->

# Claude Annual Analysis

一个用于分析Claude聊天记录的工具，支持token使用分析、对话模式分析和主题聚类。

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

1. 环境配置
```bash
# 克隆项目
git clone [your-repo-url]

# 安装依赖
pip install -r requirements.txt
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
python main.py
```

## 项目结构

- `main.py`: 主程序入口
- `chat_analyzer.py`: 聊天数据分析核心模块
- `text_clustering.py`: 文本聚类分析模块
- `utils.py`: 通用工具函数
- `dashboard/`: 可视化面板目录

## 技术栈

- Python 3.8+
- OpenAI API
- Sentence Transformers
- FAISS
- UMAP
- DBSCAN
- Plotly
- Next.js (Dashboard)

# token 指数，按照日期统计每日消耗的token数目，生成对应的统计图表
- 平均对话时长/来回次数
- 最长的一次连续对话持续了多久,聊了什么

# 使用场景分析
- 工作/学习/生活各场景的使用比例
- 在一天中的什么时段对话最多
- 季节性的使用特点（春、夏、秋、冬）

# 主题聚类，基于text-clustering项目完成，支持聚类结果可视化
- 探讨最多的知识领域有哪些
- 一段文艺的，总结性结尾
