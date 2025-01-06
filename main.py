"""
Author: ByronVon
Date: 2025-01-03 21:55:00
FilePath: /ClaudeAnnualAnalysis/main.py
Description: 
"""

from dotenv import load_dotenv
import os
from rich import print

os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

load_dotenv()

from chat_analyzer import ChatAnalyzer
from text_clustering import ClusterClassifier
from utils import load_chat_data, save_result


def main():

    if not os.path.exists("./out"):
        os.makedirs("./out", exist_ok=True)

    chat_data = load_chat_data("./data/conversations.json")

    analyzer = ChatAnalyzer(chat_data)

    analyzer.df.to_csv("./out/conversation.csv", index=False)

    classifier = ClusterClassifier(
        embed_device="cpu",
        embed_batch_size=4,
        summary_create=True,
        summary_n_examples=10,
        dbscan_eps=0.3,
        dbscan_min_samples=3,
        summary_model_token=os.getenv("openai_api_key"),
        summary_model_base=os.getenv("openai_api_base"),
        summary_model=os.getenv("openai_model_name"),
    )

    # 1. 对话时长分析
    duration_stats = analyzer.analyze_chat_duration()

    # 2. 时间模式分析
    time_patterns = analyzer.analyze_time_patterns()

    # 对结果按频率排序
    sorted_clusters = sorted(
        [(k, v) for k, v in summaries.items() if k != -1],  # 排除噪声点(-1)
        key=lambda x: x[1]["nums"],
        reverse=True,
    )

    # 输出分析结果
    print("=== Chat Analysis Results ===")
    print(f"\nAverage chat duration: {duration_stats['average_duration']}")
    print(f"Total chat duration: {duration_stats['total_duration']}")
    print(f"Average turns per chat: {duration_stats['average_turns']:.2f}")
    print(f"\nLongest chat: {duration_stats['longest_chat']['duration']}")
    print(f"Longest chat topic: {duration_stats['longest_chat']['name']}")
    print(f"\nHourly Chat Distribution:\n{time_patterns['hourly_pattern']}")
    print(f"\nSeasonal Chat Distribution:\n{time_patterns['seasonal_pattern']}")

    # 打印排序后的聚类结果
    print("\n=== Topic Clusters (Sorted by Frequency) ===")
    for cluster_id, cluster_info in sorted_clusters:
        print(f"\nCluster {cluster_id} ({cluster_info['nums']} conversations):")
        print(cluster_info["cluster"])

    # 保存结果，用于可视化展示
    save_result("./out/cluster_summaries.json", summaries)
    save_result("./out/duration_stats.json", duration_stats)
    save_result("./out/time_patterns.json", time_patterns)


if __name__ == "__main__":
    main()
